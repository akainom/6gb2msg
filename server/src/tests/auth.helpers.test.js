const { parseCookies, buildCookieHeader } = require('./auth.helpers');

describe('auth.helpers', () => {
    describe('parseCookies', () => {
        it('should parse Set-Cookie header array', () => {
            const mockResponse = {
                headers: {
                    getSetCookie: () => [
                        'refreshToken=abc123; Path=/; HttpOnly',
                        'accessToken=xyz789; Path=/',
                    ]
                }
            };
            const result = parseCookies(mockResponse);
            expect(result).toEqual({
                refreshToken: 'abc123',
                accessToken: 'xyz789',
            });
        });

        it('should return empty object for empty headers', () => {
            const mockResponse = { headers: { getSetCookie: () => [] } };
            const result = parseCookies(mockResponse);
            expect(result).toEqual({});
        });

        it('should handle missing getSetCookie', () => {
            const mockResponse = { headers: {} };
            const result = parseCookies(mockResponse);
            expect(result).toEqual({});
        });

        it('should trim whitespace from values', () => {
            const mockResponse = {
                headers: {
                    getSetCookie: () => ['token=  value123  ; Path=/']
                }
            };
            const result = parseCookies(mockResponse);
            expect(result.token).toBe('value123');
        });
    });

    describe('buildCookieHeader', () => {
        it('should build cookie header string', () => {
            const cookies = {
                refreshToken: 'abc123',
                accessToken: 'xyz789',
            };
            const result = buildCookieHeader(cookies);
            expect(result).toBe('refreshToken=abc123; accessToken=xyz789');
        });

        it('should handle empty object', () => {
            const result = buildCookieHeader({});
            expect(result).toBe('');
        });
    });
});

describe('ApiError', () => {
    it('should have correct structure', () => {
        const { ApiError } = require('../mw/exception');
        const error = new ApiError('test message', 400, 'ERR_TEST', null);
        expect(error.message).toBe('test message');
        expect(error.code).toBe('ERR_TEST');
        expect(error.status).toBe(400);
    });

    it('should be instance of Error', () => {
        const { ApiError } = require('../mw/exception');
        const error = new ApiError('test', 500, 'ERR_TEST', null);
        expect(error).toBeInstanceOf(Error);
    });
});

describe('previewText', () => {
    it('should truncate long content', () => {
        const longText = 'a'.repeat(150);
        const { previewText } = require('./message.utils');
        const result = previewText(longText);
        expect(result.length).toBeLessThanOrEqual(123);
        expect(result.endsWith('…')).toBe(true);
    });

    it('should not truncate short content', () => {
        const shortText = 'hello';
        const { previewText } = require('./message.utils');
        const result = previewText(shortText);
        expect(result).toBe('hello');
    });

    it('should handle empty content', () => {
        const { previewText } = require('./message.utils');
        const result = previewText('');
        expect(result).toBe('');
    });

    it('should handle null content', () => {
        const { previewText } = require('./message.utils');
        const result = previewText(null);
        expect(result).toBe('');
    });

    it('should handle max parameter', () => {
        const { previewText } = require('./message.utils');
        const result = previewText('hello world', 5);
        expect(result).toBe('hello…');
    });
});