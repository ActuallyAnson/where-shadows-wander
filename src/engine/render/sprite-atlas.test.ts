import { describe, expect, it, vi } from 'vitest';
import { Kind } from '../sim/entity-kinds';
import {
  ATLAS_SIZE,
  GRID_COLS,
  GRID_ROWS,
  getSpriteUvBounds,
  getTileForKind,
  renderSpriteAtlasToCanvas,
  createSpriteAtlas,
  SpriteTile,
} from './sprite-atlas';

describe('sprite-atlas', () => {
  it('defines correct atlas dimensions and grid', () => {
    expect(ATLAS_SIZE).toBe(1024);
    expect(GRID_COLS).toBe(4);
    expect(GRID_ROWS).toBe(4);
  });

  it('maps UV coordinates correctly for each grid cell', () => {
    // Top-left cell [0,0] (Traveller Idle): uOffset = 0, vOffset = (4 - 1 - 0) * 0.25 = 0.75
    const uv00 = getSpriteUvBounds(0, 0);
    expect(uv00[0]).toBeCloseTo(0.0);
    expect(uv00[1]).toBeCloseTo(0.75);
    expect(uv00[2]).toBeCloseTo(0.25);
    expect(uv00[3]).toBeCloseTo(0.25);

    // Bottom-right cell [3,3]: uOffset = 3 * 0.25 = 0.75, vOffset = (4 - 1 - 3) * 0.25 = 0.0
    const uv33 = getSpriteUvBounds(3, 3);
    expect(uv33[0]).toBeCloseTo(0.75);
    expect(uv33[1]).toBeCloseTo(0.0);
    expect(uv33[2]).toBeCloseTo(0.25);
    expect(uv33[3]).toBeCloseTo(0.25);

    // Row 1 Col 1 (Rock): uOffset = 0.25, vOffset = 0.50
    const uvRock = getSpriteUvBounds(SpriteTile.Rock.col, SpriteTile.Rock.row);
    expect(uvRock[0]).toBeCloseTo(0.25);
    expect(uvRock[1]).toBeCloseTo(0.5);
  });

  it('selects correct sprite tiles for all gameplay entity kinds', () => {
    expect(getTileForKind(Kind.Traveller, 0)).toEqual({ col: 0, row: 0 });
    expect(getTileForKind(Kind.Traveller, 1)).toEqual({ col: 1, row: 0 });
    expect(getTileForKind(Kind.Traveller, 2)).toEqual({ col: 2, row: 0 });
    expect(getTileForKind(Kind.Traveller, 3)).toEqual({ col: 3, row: 0 });

    expect(getTileForKind(Kind.Rock)).toEqual({ col: 1, row: 1 });
    expect(getTileForKind(Kind.Raindrop)).toEqual({ col: 0, row: 1 });
    expect(getTileForKind(Kind.Crow)).toEqual({ col: 2, row: 1 });
    expect(getTileForKind(Kind.Rabbit)).toEqual({ col: 3, row: 1 });
    expect(getTileForKind(Kind.Fox)).toEqual({ col: 0, row: 2 });
    expect(getTileForKind(Kind.Firefly)).toEqual({ col: 1, row: 2 });
  });

  it('renders into a mock canvas without throwing', () => {
    const mockCtx = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      arcTo: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      ellipse: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
      lineJoin: '',
      globalCompositeOperation: '',
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
    } as unknown as HTMLCanvasElement;

    renderSpriteAtlasToCanvas(mockCanvas);

    expect(mockCanvas.width).toBe(1024);
    expect(mockCanvas.height).toBe(1024);
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 1024, 1024);
    expect(mockCtx.translate).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it('creates a CanvasTexture configured for crisp unscaled pixel rendering', () => {
    const texture = createSpriteAtlas();
    expect(texture).toBeDefined();
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(1006); // LinearFilter
  });
});
