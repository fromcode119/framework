/**
 * AI Extension Entry Point
 * 
 * This file implements the core extension lifecycle hooks for the AI package.
 * When the AI extension is loaded by CoreExtensionManager, it:
 * - Registers the AI integration type with IntegrationManager
 * - Registers capabilities (ai, mcp, llm)
 * - Registers admin UI components (handled separately by admin extension)
 * - Registers API routes (will be handled when API migration is complete)
 */

import type { CoreExtensionContext } from '@fromcode119/core';
import { AiIntegrationDefinition } from './integration-provider';
import { registerAssistantRoutes } from './api/routes';

/**
 * Called when the extension is first loaded and initialized
 */
export async function onInit(context: CoreExtensionContext): Promise<void> {
  const { logger, integrations } = context.services;
  
  logger.info('Initializing AI extension...');
  
  // Register AI integration type with IntegrationManager
  if (integrations) {
    try {
      integrations.registerType(AiIntegrationDefinition);
      logger.info('Registered AI integration type');
    } catch (error) {
      logger.error('Failed to register AI integration type:', error);
      throw error;
    }
  } else {
    logger.warn('IntegrationManager not available, skipping integration registration');
  }
  
  // Register capabilities that this extension provides
  context.registerCapability('ai');
  context.registerCapability('mcp');
  context.registerCapability('llm');
  context.registerCapability('forge-assistant');
  
  // Register API routes factory function
  if (context.registerApiRoutes) {
    context.registerApiRoutes(registerAssistantRoutes);
    logger.info('Registered Assistant API routes factory');
  } else {
    logger.warn('API route registration not available');
  }
  
  logger.info('AI extension initialized successfully');
}

/**
 * Called when the extension is enabled
 */
export async function onEnable(context: CoreExtensionContext): Promise<void> {
  const { logger } = context.services;
  logger.info('AI extension enabled');
}

/**
 * Called when the extension is disabled
 */
export async function onDisable(context: CoreExtensionContext): Promise<void> {
  const { logger, integrations } = context.services;
  logger.info('AI extension disabled - cleaning up...');
  
  try {
    // 1. Unregister all capabilities
    const registeredCapabilities = context.getRegisteredCapabilities();
    for (const capability of registeredCapabilities) {
      context.unregisterCapability(capability);
    }
    logger.info(`Unregistered ${registeredCapabilities.length} capabilities: ${registeredCapabilities.join(', ')}`);
    
    // 2. Unregister integration type
    if (integrations && typeof integrations.unregisterType === 'function') {
      integrations.unregisterType('ai');
      logger.info('Unregistered AI integration type');
    }
    
    // 3. API routes cleanup
    // Note: API routes are conditionally registered by checking isExtensionActive('ai')
    // When extension is disabled, isExtensionActive will return false and routes won't be registered
    // on next server restart. No explicit cleanup needed for already-registered routes.
    
    // 4. Admin UI cleanup
    // Admin extension loader uses dynamic imports with try/catch.
    // When AI package is disabled, import will fail gracefully and UI won't be registered.
    // Node.js module cache will be cleared on next admin rebuild.
    
    logger.info('AI extension cleanup complete');
  } catch (error) {
    logger.error('Error during AI extension cleanup:', error);
    throw error;
  }
}
