/**
 * Class-based middleware infrastructure.
 * 
 * All middlewares should extend BaseMiddleware for consistency.
 * 
 * @module @fromcode119/api/middlewares
 */

// Base classes
export { BaseMiddleware, FunctionalMiddleware, createMiddleware } from './BaseMiddleware';

// Collection middleware
export { CollectionMiddleware } from './CollectionMiddleware';

// Security middlewares
export { 
  CSRFMiddleware, 
  XSSMiddleware, 
  SecurityHeadersMiddleware,
  csrfMiddleware,
  xssMiddleware
} from './SecurityMiddleware';

// Rate limiting
export { 
  RateLimitMiddleware, 
  createDynamicRateLimiter,
  type RateLimitOptions 
} from './RateLimitMiddleware';

// Validation
export { 
  ValidationMiddleware, 
  Validators,
  type ValidatorFunction,
  type ValidationOptions 
} from './ValidationMiddleware';
