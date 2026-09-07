import * as vscode from 'vscode';
import { findFlagUsages, findNamingViolations, findLikelyTypoGroups, FlagUsage } from './flagInventory';

let diagnostics: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel | undefined;

const APPLICABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go'];

function isApplicable(document: vscode.TextDocument): boolean {
  return APPLICABLE_EXTENSIONS.some((ext) => document.uri.path.endsWith(ext));
}

async function scanWorkspace(): Promise<{ usages: FlagUsage[]; uris: Map<string, vscode.Uri> }> {
  const pattern = `**/*{${APPLICABLE_EXTENSIONS.join(',')}}`;
  const files = await vscode.workspace.findFiles(pattern, '**/{node_modules,dist,build,out,.git}/**', 5000);
  const usages: FlagUsage[] = [];
  const uris = new Map<string, vscode.Uri>();

  for (const uri of files) {
    let text: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      text = Buffer.from(bytes).toString('utf8');
    } catch {
      continue;
    }
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    uris.set(relativePath, uri);
    usages.push(...findFlagUsages(relativePath, text));
  }

  return { usages, uris };
}

function refreshDiagnosticsFromUsages(usages: FlagUsage[], uris: Map<string, vscode.Uri>): void {
  diagnostics.clear();
  const byFile = new Map<string, vscode.Diagnostic[]>();

  const namingViolations = findNamingViolations(usages);
  for (const violation of namingViolations) {
    for (const usage of violation.usages) {
      const range = new vscode.Range(usage.line - 1, 0, usage.line - 1, Number.MAX_SAFE_INTEGER);
      const diagnostic = new vscode.Diagnostic(
        range,
        `Flag name "${violation.flagName}" isn't kebab-case -- Unleash's own docs consistently use kebab-case flag names.`,
        vscode.DiagnosticSeverity.Information,
      );
      diagnostic.source = 'Unleash Flag Usage Companion';
      diagnostic.code = 'NAMING';
      const list = byFile.get(usage.file) ?? [];
      list.push(diagnostic);
      byFile.set(usage.file, list);
    }
  }

  const typoGroups = findLikelyTypoGroups(usages);
  for (const group of typoGroups) {
    const otherNames = group.variants.map((v) => v.flagName).join('", "');
    for (const variant of group.variants) {
      for (const usage of variant.usages) {
        const range = new vscode.Range(usage.line - 1, 0, usage.line - 1, Number.MAX_SAFE_INTEGER);
        const diagnostic = new vscode.Diagnostic(
          range,
          `"${usage.flagName}" looks like it might be a typo of a differently-spelled flag with the same normalized name: "${otherNames}". Unleash treats these as entirely separate flags.`,
          vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = 'Unleash Flag Usage Companion';
        diagnostic.code = 'LIKELY_TYPO';
        const list = byFile.get(usage.file) ?? [];
        list.push(diagnostic);
        byFile.set(usage.file, list);
      }
    }
  }

  for (const [file, diags] of byFile) {
    const uri = uris.get(file);
    if (uri) diagnostics.set(uri, diags);
  }
}

function output(): vscode.OutputChannel {
  if (!outputChannel) outputChannel = vscode.window.createOutputChannel('Unleash Flag Usage Companion');
  return outputChannel;
}

function showInventory(usages: FlagUsage[]): void {
  const byName = new Map<string, FlagUsage[]>();
  for (const usage of usages) {
    if (!byName.has(usage.flagName)) byName.set(usage.flagName, []);
    byName.get(usage.flagName)!.push(usage);
  }

  const channel = output();
  channel.clear();
  channel.appendLine(`Unleash Flag Usage Companion -- ${byName.size} distinct flag(s), ${usages.length} usage(s)\n`);
  const names = [...byName.keys()].sort();
  for (const name of names) {
    const flagUsages = byName.get(name)!;
    channel.appendLine(`${name}  (${flagUsages.length} usage${flagUsages.length === 1 ? '' : 's'})`);
    for (const usage of flagUsages) {
      channel.appendLine(`    ${usage.file}:${usage.line}`);
    }
  }
  channel.show(true);
}

async function runScanAndReport(): Promise<{ usages: FlagUsage[]; uris: Map<string, vscode.Uri> }> {
  const { usages, uris } = await scanWorkspace();
  refreshDiagnosticsFromUsages(usages, uris);
  return { usages, uris };
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('unleashFlagUsageCompanion');
  context.subscriptions.push(diagnostics);

  void runScanAndReport();

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isApplicable(doc)) void runScanAndReport();
    }),
    vscode.commands.registerCommand('unleashFlagUsageCompanion.showInventory', async () => {
      const { usages } = await runScanAndReport();
      showInventory(usages);
    }),
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
  outputChannel?.dispose();
}
