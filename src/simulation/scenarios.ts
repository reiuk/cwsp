/**
 * Scenario management — creates custom scenarios from slider values.
 */

import { ScenarioConfig } from './types';
import { SCENARIOS } from './parameters';

export { SCENARIOS };

/** Create a custom scenario from user-specified parameters */
export function createCustomScenario(
  bacterialLoad: number,
  vascularDensity: number,
  antibioticTiming: number | null,
  antibioticDose: number,
): ScenarioConfig {
  return {
    name: 'Custom',
    description: 'User-defined parameters',
    initialBacterialLoad: bacterialLoad,
    vascularDensityMultiplier: vascularDensity,
    antibioticStartTick: antibioticTiming,
    antibioticDose,
  };
}
