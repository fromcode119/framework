/**
 * Class-based middleware infrastructure.
 * 
 * All middlewares should extend BaseMiddleware for consistency.
 * 
 * @module @fromcode119/api/middlewares
 */

// Base classes
export { BaseMiddleware } from '@api/middlewares/base-middleware';
export { FunctionalMiddleware } from '@api/middlewares/functional-middleware';

// Collection middleware
export { CollectionMiddleware } from '@api/middlewares/collection-middleware';

// Security middlewares
export { CSRFMiddleware } from '@api/middlewares/csrf-middleware';
export { XSSMiddleware } from '@api/middlewares/xss-middleware';
export { SecurityHeadersMiddleware } from '@api/middlewares/security-headers-middleware';
export { JsonCompressionMiddleware } from '@api/middlewares/json-compression-middleware';

// Rate limiting
export { RateLimitMiddleware } from '@api/middlewares/rate-limit-middleware';

// Validation
export { ValidationMiddleware } from '@api/middlewares/validation/validation-middleware';

export { Validators } from '@api/middlewares/validators';
