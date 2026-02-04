/**
 * Architecture Fitness Function
 *
 * This test validates DDD architectural rules:
 * - Repositories must not be imported from other bounded contexts
 * - Cross-context communication should happen through Services only
 * - PrismaService must only be imported in infrastructure repositories
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
  notifications: 'src/notifications',
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

/**
 * Check if a file imports PrismaService
 */
function findPrismaServiceImports(filePath: string): {
  file: string;
  line: number;
  lineContent: string;
}[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: {
    file: string;
    line: number;
    lineContent: string;
  }[] = [];

  // Pattern to match PrismaService imports (exact word boundary match)
  // Matches: import { PrismaService } from '...'
  // Matches: import PrismaService from '...'
  // Matches: import { Something, PrismaService } from '...'
  const prismaImportPattern =
    /import\s+(?:{[\s\S]*?\bPrismaService\b[\s\S]*?}|\*\s+as\s+PrismaService|PrismaService)\s+from\s+['"]/;
  
  // Pattern to match PrismaService type annotation in constructor/injection
  const prismaConstructorPattern =
    /(?:private|public|protected)\s+(?:readonly\s+)?\w+:\s*PrismaService\b/;
  const prismaInjectionPattern =
    /@Inject\([^)]*\bPrismaService\b/;
  
  // Pattern to match this.prisma usage (indicates PrismaService dependency)
  const prismaUsagePattern =
    /this\.prisma\./;

  lines.forEach((line, index) => {
    // Skip comments
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
      return;
    }

    const hasImport = prismaImportPattern.test(line);
    const hasConstructor = prismaConstructorPattern.test(line);
    const hasInjection = prismaInjectionPattern.test(line);
    const hasUsage = prismaUsagePattern.test(line);

    // Only flag if it's a real PrismaService import/usage
    // Use word boundary to avoid false positives like "PrismaServiceProviderMapper"
    if (hasImport || hasConstructor || hasInjection || hasUsage) {
      // Additional check: ensure it's actually PrismaService, not a substring
      const isRealPrismaService =
        /\bPrismaService\b/.test(line) &&
        !line.match(/PrismaService\w+/) && // Not followed by more word chars
        !line.match(/\w+PrismaService/); // Not preceded by word chars

      if (isRealPrismaService || hasUsage) {
        violations.push({
          file: filePath,
          line: index + 1,
          lineContent: trimmedLine,
        });
      }
    }
  });

  return violations;
}

/**
 * Check if a file is allowed to import PrismaService
 */
function isAllowedPrismaImport(filePath: string): boolean {
  // Allow PrismaService in infrastructure repositories
  if (filePath.includes('/infrastructure/repositories/')) {
    return true;
  }

  // Allow PrismaService in the PrismaService/PrismaModule itself
  if (
    filePath.includes('/shared/infrastructure/prisma/prisma.service.ts') ||
    filePath.includes('/shared/infrastructure/prisma/prisma.module.ts')
  ) {
    return true;
  }

  // Allow in health checks (they might need direct DB access)
  if (filePath.includes('/health/')) {
    return true;
  }

  // Allow in jobs (they might need direct DB access for batch operations)
  if (filePath.includes('/application/jobs/')) {
    return true;
  }

  // Block everywhere else (application services, domain, presentation, etc.)
  return false;
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

  describe('PrismaService Encapsulation', () => {
    it('should only import PrismaService in infrastructure repositories', () => {
      const allViolations: {
        file: string;
        line: number;
        lineContent: string;
      }[] = [];

      // Check all TypeScript files in src
      const srcPath = path.join(process.cwd(), 'src');
      const allFiles = getAllTsFiles(srcPath);

      for (const file of allFiles) {
        // Skip test files
        if (file.includes('.spec.') || file.includes('__tests__')) {
          continue;
        }

        // Check if file imports PrismaService
        const prismaImports = findPrismaServiceImports(file);

        // If file has PrismaService imports, check if it's allowed
        if (prismaImports.length > 0 && !isAllowedPrismaImport(file)) {
          allViolations.push(...prismaImports);
        }
      }

      // Format violations for error message
      const errorMessage =
        allViolations.length > 0
          ? [
              '\n\n🚨 PRISMA SERVICE ENCAPSULATION VIOLATION DETECTED 🚨',
              '',
              'The following files import PrismaService outside of infrastructure repositories.',
              'This violates DDD layering principles.',
              '',
              '❌ PrismaService should only be used in:',
              '   - Infrastructure repositories (infrastructure/repositories/)',
              '   - Application jobs (application/jobs/)',
              '   - Health checks (health/)',
              '',
              '✅ Instead of using PrismaService directly, use:',
              '   - Repository interfaces in domain layer',
              '   - Service methods in application layer',
              '',
              'Violations found:',
              '',
              ...allViolations.map(
                (v) =>
                  `  📁 ${v.file}:${v.line}\n     Line: ${v.lineContent}\n`,
              ),
              '',
              '📚 See PERSISTENCE_BOUNDARIES.md for more details.',
              '',
            ].join('\n')
          : '';

      if (allViolations.length > 0) {
        throw new Error(errorMessage);
      }
      expect(allViolations.length).toBe(0);
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
