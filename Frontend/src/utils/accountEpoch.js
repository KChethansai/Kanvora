// Process-lifetime identity boundary. Never reset/reuse this counter: a response
// from an earlier account must not become current again after another login.
let accountEpoch = 0

export const getAccountEpoch = () => accountEpoch
export const invalidateAccountEpoch = () => ++accountEpoch
export const isAccountEpochCurrent = (epoch) => epoch === accountEpoch
