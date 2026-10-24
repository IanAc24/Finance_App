// A lock for an async action that must not run twice at the same time (the
// Save button: three quick taps must create one transaction, not three).
//
//   const runOnce = onceAtATime()
//   const save = () => runOnce(async () => { ...write... })
//
// The task starts synchronously on the first call. While it is running, every
// other call is ignored and gets the promise of the one in progress. When the
// task ends (done or failed) the lock is free again. React state cannot do
// this: it does not update between two events of the same tick.
export function onceAtATime() {
  let pending = null

  return function runOnce(task) {
    if (pending) return pending
    let started
    try {
      started = Promise.resolve(task())
    } catch (error) {
      started = Promise.reject(error)
    }
    pending = started.finally(() => {
      pending = null
    })
    return pending
  }
}
