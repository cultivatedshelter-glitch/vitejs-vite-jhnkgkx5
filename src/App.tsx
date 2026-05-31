import React, { Suspense } from 'react'

const ShelterPrepWorkspace = React.lazy(() => import('./pages/ShelterPrepWorkspace'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <ShelterPrepWorkspace />
    </Suspense>
  )
}
