import { describe, expect, it } from 'vitest'
import { onceAtATime } from './onceAtATime'

// A task that ends when the test says so
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('onceAtATime', () => {
  it('runs the task once when called three times in the same tick', async () => {
    const runOnce = onceAtATime()
    const gate = deferred()
    let runs = 0
    const task = () => {
      runs += 1
      return gate.promise
    }

    const first = runOnce(task)
    const second = runOnce(task)
    const third = runOnce(task)
    expect(runs).toBe(1)
    expect(second).toBe(first)
    expect(third).toBe(first)

    gate.resolve('saved')
    await expect(first).resolves.toBe('saved')
  })

  it('starts the task synchronously on the first call', () => {
    const runOnce = onceAtATime()
    let started = false
    runOnce(async () => {
      started = true
    })
    expect(started).toBe(true)
  })

  it('lets a new call run once the task has finished', async () => {
    const runOnce = onceAtATime()
    let runs = 0
    const task = async () => {
      runs += 1
    }
    await runOnce(task)
    await runOnce(task)
    expect(runs).toBe(2)
  })

  it('frees the lock when the task fails, and passes the error on', async () => {
    const runOnce = onceAtATime()
    const failing = runOnce(async () => {
      throw new Error('disk full')
    })
    await expect(failing).rejects.toThrow('disk full')

    let runs = 0
    await runOnce(async () => {
      runs += 1
    })
    expect(runs).toBe(1)
  })

  it('treats a task that throws before returning like a failed one', async () => {
    const runOnce = onceAtATime()
    const failing = runOnce(() => {
      throw new Error('bad')
    })
    await expect(failing).rejects.toThrow('bad')
    await expect(runOnce(async () => 'ok')).resolves.toBe('ok')
  })

  it('ignores calls while a task waits, even with a different task', async () => {
    const runOnce = onceAtATime()
    const gate = deferred()
    let other = 0
    const first = runOnce(() => gate.promise)
    runOnce(async () => {
      other += 1
    })
    gate.resolve()
    await first
    expect(other).toBe(0)
  })
})
