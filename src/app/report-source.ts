// What our code adds to the diagnostics report (src/debug, Teammate B's).
// Diagnostics.addSource keeps a single source, so everything goes through here.
import type { CapabilityDetector } from '../engine/xr/capabilities';

export interface ReportInputs {
  simHz: number;
  simSteps: number;
  handReadMethod: Readonly<Record<string, number>>;
  /** The mock source's name in mock mode (?mock=1), else null. */
  mockSource: string | null;
  capabilities: CapabilityDetector;
}

export function reportSource(i: ReportInputs): Record<string, unknown> {
  return {
    sim: { hz: i.simHz, steps: i.simSteps },
    handReadMethod: { ...i.handReadMethod },
    mock: i.mockSource ? { source: i.mockSource } : null,
    capabilities: i.capabilities.toJSON(),
  };
}
