// react-three-fiber is a way to express threejs declaratively: https://github.com/react-spring/react-three-fiber
import { Canvas, useFrame, useLoader } from "react-three-fiber"
// use-cannon is a hook around the cannon.js physics library: https://github.com/react-spring/use-cannon
import { Physics, useSphere, useBox, usePlane } from "use-cannon"
// zustand is a minimal state-manager: https://github.com/react-spring/zustand
import create from "zustand"

import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import React, { Suspense, useRef, useCallback } from "react"
import lerp from "lerp"
import clamp from "lodash-es/clamp"
import Text from "./Text"
import pingSound from "./resources/ping.mp3"
import earthImg from "./resources/cross.jpg"

// Create a store ...
const ping = new Audio(pingSound)
const [useStore] = create(set => ({
  count: 0,
  welcome: true,
  api: {
    pong(velocity) {
      ping.currentTime = 0
      ping.volume = clamp(velocity / 20, 0, 1)
      ping.play()
      if (velocity > 4) set(state => ({ count: state.count + 1 }))
    },
    reset: welcome => set(state => ({ welcome, count: welcome ? state.count : 0 })),
  },
}))

// The paddle was made in blender and auto-converted to JSX by https://github.com/react-spring/gltfjsx
function Paddle() {
  // Load the gltf file
  const { nodes, materials } = useLoader(GLTFLoader, "/pingpong.glb")
  // Fetch some reactive state
  const { pong } = useStore(state => state.api)
  const welcome = useStore(state => state.welcome)
  const count = useStore(state => state.count)
  const model = useRef()
  // Make it a physical object that adheres to gravitation and impact
  const [ref, api] = useBox(() => ({ type: "Kinematic", args: [3.4, 1, 3.5], onCollide: e => pong(e.contact.impactVelocity) }))
  // use-frame allows the component to subscribe to the render-loop for frame-based actions
  let values = useRef([0, 0])
  useFrame(state => {
    // The paddle is kinematic (not subject to gravitation), we move it with the api returned by useBox
    values.current[0] = lerp(values.current[0], (state.mouse.x * Math.PI) / 5, 0.2)
    values.current[1] = lerp(values.current[1], (state.mouse.x * Math.PI) / 5, 0.2)
    api.position.set(state.mouse.x * 10, state.mouse.y * 5, 0)
    api.rotation.set(0, 0, values.current[1])
    // Left/right mouse movement rotates it a liitle for effect only
    model.current.rotation.x = lerp(model.current.rotation.x, welcome ? Math.PI / 2 : 0, 0.2)
    model.current.rotation.y = values.current[0]
  })
  return (
    <mesh ref={ref} dispose={null}>
      <group ref={model} position={[-0.05, 0.37, 0.3]} scale={[0.15, 0.15, 0.15]}>
        <Text rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 2]} size={1} children={count.toString()} />
        <group rotation={[1.88, -0.35, 2.32]} scale={[2.97, 2.97, 2.97]}>
          <primitive object={nodes.Bone} />
          <primitive object={nodes.Bone003} />
          <primitive object={nodes.Bone006} />
          <primitive object={nodes.Bone010} />
          <skinnedMesh castShadow receiveShadow material={materials.glove} material-roughness={1} geometry={nodes.arm.geometry} skeleton={nodes.arm.skeleton} />
        </group>
        <group rotation={[0, -0.04, 0]} scale={[141.94, 141.94, 141.94]}>
          <mesh castShadow receiveShadow material={materials.wood} geometry={nodes.mesh_0.geometry} />
          <mesh castShadow receiveShadow material={materials.side} geometry={nodes.mesh_1.geometry} />
          <mesh castShadow receiveShadow material={materials.foam} geometry={nodes.mesh_2.geometry} />
          <mesh castShadow receiveShadow material={materials.lower} geometry={nodes.mesh_3.geometry} />
          <mesh castShadow receiveShadow material={materials.upper} geometry={nodes.mesh_4.geometry} />
        </group>
      </group>
    </mesh>
  )
}

function Ball() {
  // Load texture (the black plus sign)
  const map = useLoader(THREE.TextureLoader, earthImg)
  // Make the ball a physics object with a low mass
  const [ref] = useSphere(() => ({ mass: 1, args: 0.5, position: [0, 5, 0] }))
  return (
    <mesh castShadow ref={ref}>
      <sphereBufferGeometry attach="geometry" args={[0.5, 64, 64]} />
      <meshStandardMaterial attach="material" map={map} />
    </mesh>
  )
}

function ContactGround() {
  // When the ground was hit we reset the game ...
  const { reset } = useStore(state => state.api)
  const [ref] = usePlane(() => ({ type: "Static", rotation: [-Math.PI / 2, 0, 0], position: [0, -10, 0], onCollide: () => reset(true) }))
  return <mesh ref={ref} />
}

export default function() {
  const welcome = useStore(state => state.welcome)
  const { reset } = useStore(state => state.api)
  const onClick = useCallback(() => welcome && reset(false), [welcome, reset])
  return (
    <>
      <Canvas shadowMap sRGB camera={{ position: [0, 5, 12], fov: 50 }} onClick={onClick}>
        <color attach="background" args={["#171720"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[-10, -10, -10]} />
        <spotLight
          position={[10, 10, 10]}
          angle={0.3}
          penumbra={1}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
        />
        <Physics
          iterations={20}
          tolerance={0.0001}
          defaultContactMaterial={{
            friction: 0.9,
            restitution: 0.7,
            contactEquationStiffness: 1e7,
            contactEquationRelaxation: 1,
            frictionEquationStiffness: 1e7,
            frictionEquationRelaxation: 2,
          }}
          gravity={[0, -40, 0]}
          allowSleep={false}>
          <mesh position={[0, 0, -10]} receiveShadow>
            <planeBufferGeometry attach="geometry" args={[1000, 1000]} />
            <meshPhongMaterial attach="material" color="#172017" />
          </mesh>
          <ContactGround />
          {!welcome && <Ball />}
          <Suspense fallback={null}>
            <Paddle />
          </Suspense>
        </Physics>
      </Canvas>
      <div className="startup" style={{ display: welcome ? "block" : "none" }}>
        * click to start ...
      </div>
    </>
  )
}
