import { describe, expect, it } from 'vitest';
import { isEmulatorOfferHost, type OfferHostLike } from './emulator-offer';

function host(tagName: string, buttons: readonly string[] | null): OfferHostLike {
  return {
    tagName,
    shadowRoot: buttons && {
      querySelectorAll: () => buttons.map((textContent) => ({ textContent })),
    },
  };
}

describe('isEmulatorOfferHost', () => {
  it("finds the emulator's Enter XR bar", () => {
    expect(isEmulatorOfferHost(host('DIV', [' Enter XR ']))).toBe(true);
  });

  it('leaves other shadow-root elements alone', () => {
    expect(isEmulatorOfferHost(host('DIV', ['Reset', 'Hands']))).toBe(false);
    expect(isEmulatorOfferHost(host('DIV', []))).toBe(false);
  });

  it('needs a div with a shadow root', () => {
    expect(isEmulatorOfferHost(host('DIV', null))).toBe(false);
    expect(isEmulatorOfferHost(host('SECTION', ['Enter XR']))).toBe(false);
  });
});
