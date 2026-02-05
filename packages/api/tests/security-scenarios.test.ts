import { csrfMiddleware } from '../src/middlewares/security';
import { Request, Response, NextFunction } from 'express';

describe('CSRF Middleware Security Scenarios', () => {
    let req: any;
    let res: any;
    let next: NextFunction;

    beforeEach(() => {
        req = {
            method: 'POST',
            path: '/api/v1/test',
            hostname: 'admin.framework.local',
            protocol: 'http',
            get: jest.fn().mockReturnValue(''),
            headers: {},
            cookies: {}
        };
        res = {
            cookie: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    it('should allow GET requests without CSRF check', () => {
        req.method = 'GET';
        csrfMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should block POST requests without CSRF header', () => {
        req.headers.cookie = 'fc_csrf=valid-token';
        csrfMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Invalid CSRF token'
        }));
    });

    it('should block POST requests with mismatched CSRF header', () => {
        req.headers.cookie = 'fc_csrf=valid-token';
        req.headers['x-csrf-token'] = 'invalid-token';
        csrfMiddleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow POST requests with matching CSRF header', () => {
        req.headers.cookie = 'fc_csrf=valid-token';
        req.headers['x-csrf-token'] = 'valid-token';
        csrfMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should successfully validate when multiple CSRF cookies are present and one matches the header', () => {
        const matchingToken = 'token-one';
        const otherToken = 'token-two';
        
        // Browser sends multiple cookies due to host vs domain conflict
        req.headers.cookie = `fc_csrf=${otherToken}; fc_csrf=${matchingToken}`;
        req.headers['x-csrf-token'] = matchingToken;
        
        csrfMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should successfully validate when multiple CSRF cookies are present in reverse order', () => {
        const matchingToken = 'token-one';
        const otherToken = 'token-two';
        
        req.headers.cookie = `fc_csrf=${matchingToken}; fc_csrf=${otherToken}`;
        req.headers['x-csrf-token'] = matchingToken;
        
        csrfMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalled();
    });

    it('should generate a new CSRF cookie if none exists', () => {
        req.method = 'GET';
        csrfMiddleware(req, res, next);
        
        expect(res.cookie).toHaveBeenCalledWith('fc_csrf', expect.any(String), expect.objectContaining({
            httpOnly: false,
            path: '/'
        }));
        expect(next).toHaveBeenCalled();
    });

    it('should set the domain correctly on the fresh CSRF cookie if hostname is a subdomain', () => {
        req.method = 'GET';
        req.hostname = 'admin.framework.local';
        csrfMiddleware(req, res, next);
        
        expect(res.cookie).toHaveBeenCalledWith('fc_csrf', expect.any(String), expect.objectContaining({
            domain: '.framework.local'
        }));
    });

    it('should skip CSRF check for Authorization header (stateless/safe from CSRF)', () => {
        req.headers.authorization = 'Bearer some-token';
        // No cookie, no header
        csrfMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
    
    it('should skip CSRF check for API Key header', () => {
        req.headers['x-api-key'] = 'some-key';
        csrfMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
