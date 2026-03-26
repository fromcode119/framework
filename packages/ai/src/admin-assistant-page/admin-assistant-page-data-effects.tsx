'use client';

import React from 'react';
import { AssistantConstants } from '../admin-assistant-core';
import { AdminAssistantPageGatewayService } from './admin-assistant-page-gateway-service';
import type { AdminAssistantPageDataEffectsProps } from './admin-assistant-page-data-effects.interfaces';

export function AdminAssistantPageDataEffects(props: AdminAssistantPageDataEffectsProps) {
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      props.setCheckingIntegration(true);
      try {
        const integration = await AdminAssistantPageGatewayService.fetchIntegration(props.api);
        if (cancelled) return;
        if (!props.browserState.hasProviderOrModelPreference()) {
          props.setProvider(integration.provider || 'openai');
          props.setModel(integration.model || (AssistantConstants.PROVIDER_PRESETS[integration.provider]?.[0]?.value || AssistantConstants.PROVIDER_PRESETS.openai[0].value));
          props.setBaseUrl(integration.baseUrl);
        }
        props.setIntegrationConfigured(integration.integrationConfigured);
        props.setHasSavedSecret(integration.hasSavedSecret);
      } catch {
        if (!cancelled) {
          props.setIntegrationConfigured(false);
          props.setHasSavedSecret(false);
        }
      } finally {
        if (!cancelled) props.setCheckingIntegration(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.api, props.browserState, props.setBaseUrl, props.setCheckingIntegration, props.setHasSavedSecret, props.setIntegrationConfigured, props.setModel, props.setProvider]);

  React.useEffect(() => {
    if (props.checkingIntegration || !props.uiPrefsHydrated) return;
    const timer = window.setTimeout(async () => {
      props.setLoadingProviderModels(true);
      const result = await AdminAssistantPageGatewayService.fetchProviderModels(props.api, {
        provider: props.provider,
        apiKey: props.apiKey,
        baseUrl: props.baseUrl,
        hasSavedSecret: props.hasSavedSecret,
        model: props.model,
      });
      props.setProviderModels(result.models);
      props.setProviderModelsError(result.error);
      if (result.nextModel && result.nextModel !== props.model) props.setModel(result.nextModel);
      props.setLoadingProviderModels(false);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [props.api, props.apiKey, props.baseUrl, props.checkingIntegration, props.hasSavedSecret, props.model, props.provider, props.setLoadingProviderModels, props.setModel, props.setProviderModels, props.setProviderModelsError, props.uiPrefsHydrated]);

  React.useEffect(() => {
    let cancelled = false;
    const loadTools = async () => {
      try {
        const tools = await AdminAssistantPageGatewayService.fetchTools(props.api);
        if (cancelled) return;
        props.setAvailableTools(tools);
        props.setSelectedTools((prev) => {
          const next = prev.filter((tool) => tools.some((entry) => entry.tool === tool));
          return next.length > 0 ? next : tools.map((entry) => entry.tool);
        });
      } catch {
        if (!cancelled) {
          props.setAvailableTools([]);
          props.setSelectedTools([]);
        }
      }
    };
    void loadTools();
    return () => {
      cancelled = true;
    };
  }, [props.api, props.setAvailableTools, props.setSelectedTools]);

  React.useEffect(() => {
    let cancelled = false;
    const loadSkills = async () => {
      try {
        const skills = await AdminAssistantPageGatewayService.fetchSkills(props.api);
        if (cancelled) return;
        props.setSkills(skills);
        props.setSkillId((prev) => (skills.some((entry) => entry.id === prev) ? prev : skills[0]?.id || 'general'));
      } catch {
        if (!cancelled) {
          props.setSkills([{ id: 'general', label: 'General' }]);
          props.setSkillId((prev) => prev || 'general');
        }
      }
    };
    void loadSkills();
    return () => {
      cancelled = true;
    };
  }, [props.api, props.setSkillId, props.setSkills]);

  return null;
}
