/**
 * Class-based middleware infrastructure.
 * 
 * All middlewares should extend BaseMiddleware for consistency.
 * 
 * @module @fromcode119/api/middlewares
 */

// Base classes
export { BaseMiddleware } from './base-middleware';
export { FunctionalMiddleware } from './functional-middleware';

// Collection middleware
export { CollectionMiddleware } from './collection-middleware';

// Security middlewares
export { CSRFMiddleware } from './csrf-middleware';
export { XSSMiddleware } from './xss-middleware';
export { SecurityHeadersMiddleware } from './security-headers-middleware';

// Rate limiting
export { 
  RateLimitMiddleware, 
} from './rate-limit-middleware';

// Validation
export { 
  ValidationMiddleware, 
} from './validation/validation-middleware';

export { Validators } from './validators';
