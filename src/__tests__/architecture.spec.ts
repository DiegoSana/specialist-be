/**
 * Architecture Fitness Function
 *
 * This test validates DDD architectural rules:
 * - Repositories must not be imported from other bounded contexts
 * - Cross-context communication should happen through Services only
 *
 * See ADR-002-REPOSITORY-ENCAPSULATION.md for details
 */

import * as fs from 'fs';
import * as path from 'path';

// Define bounded contexts and their paths
const CONTEXTS = {
  identity: 'src/identity',
  profiles: 'src/profiles',
  requests: 'src/requests',
  reputation: 'src/reputation',
  storage: 'src/storage',
  admin: 'src/admin',
  contact: 'src/contact',
};

// Pattern to extract context from import path
const CONTEXT_FROM_IMPORT =
  /from\s+['"]\.\.\/\.\.\/\.\.\/(\w+)\/domain\/repositories\//;

/**
 * Recursively get all TypeScript files in a directory
 */
function getAllTsFiles(dirPath: string, files: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllTsFiles(fullPath, files);
    } else if (
      item.endsWith('.ts') &&
      !item.endsWith('.spec.ts') &&
      !item.endsWith('.d.ts')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a file imports repositories from other contexts
 */
function findCrossContextRepositoryImports(
  filePath: string,
  currentContext: string,
): {
  file: string;
  line: number;
  importedContext: string;
  lineContent: string;
}[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: {
    file: string;
    line: number;
    importedContext: string;
    lineContent: string;
  }[] = [];

  lines.forEach((line, index) => {
    // Check if line imports from a repository in another context
    const match = line.match(CONTEXT_FROM_IMPORT);
    if (match) {
      const importedContext = match[1];
      if (importedContext !== currentContext) {
        violations.push({
          file: filePath,
          line: index + 1,
          importedContext,
          lineContent: line.trim(),
        });
      }
    }
  });

  return violations;
}

describe('Architecture Fitness Functions', () => {
  describe('DDD Bounded Context Encapsulation', () => {
    it('should not import repositories from other bounded contexts', () => {
      const allViolations: {
        file: string;
        line: number;
        importedContext: string;
        lineContent: string;
      }[] = [];

      // Check each bounded context
      for (const [contextName, contextPath] of Object.entries(CONTEXTS)) {
        const fullPath = path.join(process.cwd(), contextPath);
        const files = getAllTsFiles(fullPath);

        for (const file of files) {
          // Skip test files and repository definitions
          if (
            file.includes('.spec.') ||
            file.includes('/domain/repositories/')
          ) {
            continue;
          }

          const violations = findCrossContextRepositoryImports(
            file,
            contextName,
          );
          allViolations.push(...violations);
        }
      }

      // Format violations for error message
      const errorMessage =
        allViolations.length > 0
          ? [
              '\n\n🚨 DDD ARCHITECTURE VIOLATION DETECTED 🚨',
              '',
              'The following files import repositories from other bounded contexts.',
              'This violates DDD encapsulation principles.',
              '',
              '❌ Instead of importing repositories, use the corresponding Service.',
              '',
              'Violations found:',
              '',
              ...allViolations.map(
                (v) =>
                  `  📁 ${v.file}:${v.line}\n     Context imported: ${v.importedContext}\n     Line: ${v.lineContent}\n`,
              ),
              '',
              '📚 See ADR-002-REPOSITORY-ENCAPSULATION.md for more details.',
              '',
            ].join('\n')
          : '';

      if (allViolations.length > 0) {
        throw new Error(errorMessage);
      }
      expect(allViolations.length).toBe(0);
    });

    it('should only export Services from module files (not repositories)', () => {
      const violations: { file: string; exportedSymbol: string }[] = [];

      for (const [contextName, contextPath] of Object.entries(CONTEXTS)) {
        const modulePath = path.join(
          process.cwd(),
          contextPath,
          `${contextName}.module.ts`,
        );

        if (!fs.existsSync(modulePath)) {
          continue;
        }

        const content = fs.readFileSync(modulePath, 'utf-8');

        // Check if module exports any REPOSITORY tokens
        const repositoryExportPattern =
          /exports:\s*\[[^\]]*\b(\w+_REPOSITORY)\b/g;
        let match;

        while ((match = repositoryExportPattern.exec(content)) !== null) {
          violations.push({
            file: modulePath,
            exportedSymbol: match[1],
          });
        }
      }

      // Format violations for error message
      const errorMessage =
        violations.length > 0
          ? [
              '\n\n🚨 MODULE EXPORT VIOLATION DETECTED 🚨',
              '',
              'The following modules export repository tokens.',
              'Repositories should be internal to their bounded context.',
              '',
              '❌ Remove repository exports and use Services instead.',
              '',
              'Violations found:',
              '',
              ...violations.map(
                (v) => `  📁 ${v.file}\n     Exported: ${v.exportedSymbol}\n`,
              ),
              '',
              '📚 See ADR-002-REPOSITORY-ENCAPSULATION.md for more details.',
              '',
            ].join('\n')
          : '';

      if (violations.length > 0) {
        throw new Error(errorMessage);
      }
      expect(violations.length).toBe(0);
    });
  });

  describe('Module Structure', () => {
    it('each bounded context should have required layers', () => {
      const requiredLayers = [
        'domain',
        'application',
        'infrastructure',
        'presentation',
      ];

      for (const [contextName, contextPath] of Object.entries(CONTEXTS)) {
        const fullPath = path.join(process.cwd(), contextPath);

        if (!fs.existsSync(fullPath)) {
          continue; // Skip contexts that don't exist yet
        }

        for (const layer of requiredLayers) {
          const layerPath = path.join(fullPath, layer);
          if (!fs.existsSync(layerPath)) {
            // Only warn, don't fail - some contexts might not need all layers
            console.warn(`⚠️  ${contextName} is missing ${layer}/ directory`);
          }
        }
      }
    });
  });
});
