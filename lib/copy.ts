// Centralised compliance-safe copy. Per v1.3 §6.4, every numeric performance reference
// must travel with a "backtested" qualifier in immediate visual context.
// Forbidden tokens are scanned by scripts/compliance-scan.mjs at build time.

export const APPROVED = {
  edgeContext: 'Backtested. Robustness-verified. Live deployment in progress.',
  backtestQualifierShort: 'Backtested.',
  backtestQualifierLong:
    'All figures backtested over 15 years including March 2020 COVID and the 2022 bear market (out-of-sample). Past results are not indicative of future performance. Live deployment in progress.',
  livePosition:
    'The 0.5% catastrophic stop is forward-looking and applies to every live position.',
  hedgeProperty: 'Hedge property is a structural design feature based on backtested behavior.',
};

export const SAMPLE_DATA_LABEL = 'Sample data — pending production update';
