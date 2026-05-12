import { io, Socket } from 'socket.io-client'

type PipelineCallback = (data: any) => void

export function usePipelineSocket(token: string) {
  const socket: Socket = io(`${window.config.WS_URL}/pipeline`, {
    auth: { token },
  })

  const createdCallbacks: PipelineCallback[] = []
  const updatedCallbacks: PipelineCallback[] = []

  socket.on('pipeline.created', (data: any) => {
    createdCallbacks.forEach((cb) => cb(data))
  })

  socket.on('pipeline.updated', (data: any) => {
    updatedCallbacks.forEach((cb) => cb(data))
  })

  function onCreated(cb: PipelineCallback) {
    createdCallbacks.push(cb)
  }

  function onUpdated(cb: PipelineCallback) {
    updatedCallbacks.push(cb)
  }

  function disconnect() {
    socket.disconnect()
  }

  return { onCreated, onUpdated, disconnect }
}
