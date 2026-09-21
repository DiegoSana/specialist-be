import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface MessageTemplate {
  es: string;
  en: string;
}

export interface MessageTemplates {
  [key: string]: MessageTemplate;
}

/**
 * Service for loading and accessing message templates.
 * Templates are stored in a JSON file and loaded asynchronously on module initialization.
 */
@Injectable()
export class MessageTemplateService implements OnModuleInit {
  private readonly logger = new Logger(MessageTemplateService.name);
  private templates: MessageTemplates | null = null;
  private loadPromise: Promise<void> | null = null;

  /**
   * Load templates from JSON file asynchronously.
   * Called automatically on module initialization.
   */
  async onModuleInit(): Promise<void> {
    await this.loadTemplates();
  }

  /**
   * Load templates from JSON file.
   * Uses async/await to avoid blocking the event loop.
   */
  async loadTemplates(): Promise<void> {
    // If already loading, wait for that promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // If already loaded, return immediately
    if (this.templates) {
      return;
    }

    // Create and store the load promise
    this.loadPromise = this.doLoadTemplates();
    await this.loadPromise;
  }

  private async doLoadTemplates(): Promise<void> {
    // nest-cli.json's webpack build bundles everything into a single dist/main.js,
    // so __dirname at runtime is just the dist/ output root, NOT the original
    // src/shared/infrastructure/messaging/ directory structure. Asset copying still
    // preserves that structure under dist/, so paths must be built from a known
    // root (process.cwd(), which is the app's WORKDIR in every environment) rather
    // than from __dirname, which only reflects the source layout in a non-bundled
    // (ts-node/non-webpack) build.
    const relativePath = path.join(
      'shared',
      'infrastructure',
      'messaging',
      'message-templates.json',
    );
    const possiblePaths = [
      // Production (webpack bundle): /app/dist/shared/infrastructure/messaging/message-templates.json
      path.join(process.cwd(), 'dist', relativePath),
      // Non-bundled dev build (e.g. ts-node), where __dirname mirrors src's structure
      path.join(__dirname, 'message-templates.json'),
      // Fallback: absolute path from project root
      path.join(process.cwd(), 'src', relativePath),
    ];

    let lastError: Error | null = null;

    for (const templatePath of possiblePaths) {
      try {
        const fileContent = await fs.readFile(templatePath, 'utf-8');
        this.templates = JSON.parse(fileContent) as MessageTemplates;
        this.logger.log(
          `Loaded ${Object.keys(this.templates).length} message templates from ${templatePath}`,
        );
        return; // Success, exit early
      } catch (error: any) {
        lastError = error;
        // Try next path
        continue;
      }
    }

    // If we get here, all paths failed
    this.logger.error(
      `Failed to load message templates from all possible paths. Tried: ${possiblePaths.join(', ')}`,
      lastError,
    );
    this.templates = {};
  }

  /**
   * Get a template by key and language.
   * @param templateKey Template identifier (e.g., 'question_agreement')
   * @param language Language code ('es' or 'en')
   * @param variables Optional variables to replace in template (e.g., {name: 'Juan'})
   * @returns Formatted message or fallback message if template not found
   */
  async getTemplate(
    templateKey: string,
    language: 'es' | 'en' = 'es',
    variables?: Record<string, string>,
  ): Promise<string> {
    // Ensure templates are loaded
    await this.loadTemplates();

    const template = this.templates?.[templateKey];

    if (!template) {
      this.logger.warn(`Template not found: ${templateKey}`);
      return `[Template ${templateKey} not found]`;
    }

    let message = template[language] || template.es || '';

    // Replace variables in template (simple string replacement)
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
    }

    return message;
  }

  /**
   * Synchronous version of getTemplate (for backwards compatibility).
   * Should only be used if templates are guaranteed to be loaded.
   * @deprecated Use getTemplate() instead
   */
  getTemplateSync(
    templateKey: string,
    language: 'es' | 'en' = 'es',
    variables?: Record<string, string>,
  ): string {
    if (!this.templates) {
      this.logger.warn(
        'Templates not loaded. Call loadTemplates() first or use getTemplate()',
      );
      return `[Template ${templateKey} not loaded]`;
    }

    const template = this.templates[templateKey];

    if (!template) {
      this.logger.warn(`Template not found: ${templateKey}`);
      return `[Template ${templateKey} not found]`;
    }

    let message = template[language] || template.es || '';

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
    }

    return message;
  }

  /**
   * Get all available template keys.
   */
  async getAvailableTemplates(): Promise<string[]> {
    await this.loadTemplates();
    return Object.keys(this.templates || {});
  }
}
