import { describe, expect, it } from 'vitest';
import { sha256 } from '../../../utils/token';

describe('sha256', () => {
    it('returns the expected SHA-256 hash', () => {
        expect(sha256('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        );
    });

    it('returns different hashes for different inputs', () => {
        expect(sha256('abc')).not.toBe(sha256('abcd'));
    });
});
