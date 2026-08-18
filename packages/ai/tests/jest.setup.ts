import { ServerCoreServices } from '@core/services/server-core-services';

// Jest never runs the API boot path (api-bootstrap-service), which is where the SERVER-only core
// services behind ServerServiceRegistry are registered. Without this, any runtime code that reaches
// CoreServices (e.g. FactualQueryHelpers → assistantVocabulary) throws the registry's browser-guard
// error. Registration is idempotent and factories-only; nothing is constructed until a test asks.
ServerCoreServices.register();
