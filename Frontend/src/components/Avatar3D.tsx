import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Float,
  Sparkles,
  useGLTF
} from '@react-three/drei'
import { useRef, useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'

/* =========================
   CAMERA RIG
========================= */
function CameraRig() {
  useFrame(({ camera }) => {
    camera.lookAt(0, 1.0, 0)
  })
  return null
}

/* =========================
   LIP SYNC
========================= */
function useLipSync(audio: HTMLAudioElement | null) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!audio) return

    const ctx = new AudioContext()
    ctx.resume().then(() => console.log('✅ AudioContext is ready'))

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256

    const src = ctx.createMediaElementSource(audio)
    src.connect(analyser)
    analyser.connect(ctx.destination)

    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0

    const tick = () => {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      setValue(Math.min(avg / 110, 1))
      raf = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(raf)
      ctx.close()
    }
  }, [audio])

  return value
}

/* =========================
   AVATAR
========================= */
interface GLBAvatarProps {
  isSpeaking: boolean
  isListening: boolean
  audio: HTMLAudioElement | null
}

function GLBAvatar({ isSpeaking, isListening, audio }: GLBAvatarProps) {
  const groupRef = useRef<THREE.Group>(null)
  const faceMeshesRef = useRef<{ mesh: THREE.SkinnedMesh; index: number }[]>([])

  const { scene } = useGLTF('/avatar.glb')
  const mouth = useLipSync(audio)

  // Exact RPM bone name refs
  const leftShoulderRef = useRef<THREE.Bone | null>(null)
  const rightShoulderRef = useRef<THREE.Bone | null>(null)
  const leftArmRef = useRef<THREE.Bone | null>(null)
  const rightArmRef = useRef<THREE.Bone | null>(null)
  const leftForearmRef = useRef<THREE.Bone | null>(null)
  const rightForearmRef = useRef<THREE.Bone | null>(null)

  useEffect(() => {
    faceMeshesRef.current = []

    scene.traverse((obj: any) => {
      // Exact match on RPM bone names
      if (obj.isBone) {
        if (obj.name === 'LeftShoulder') leftShoulderRef.current = obj
        if (obj.name === 'RightShoulder') rightShoulderRef.current = obj
        if (obj.name === 'LeftArm') leftArmRef.current = obj
        if (obj.name === 'RightArm') rightArmRef.current = obj
        if (obj.name === 'LeftForeArm') leftForearmRef.current = obj
        if (obj.name === 'RightForeArm') rightForearmRef.current = obj
      }

      // Morph target detection for lip sync
      if (obj instanceof THREE.SkinnedMesh && obj.morphTargetDictionary) {
        const dict = obj.morphTargetDictionary
        const possibleKeys = ['viseme_aa', 'viseme_O', 'Jaw_Open', 'jawOpen', 'mouthOpen', 'MouthOpen', 'mouth_open']
        let found = false

        for (const k of possibleKeys) {
          if (dict[k] !== undefined) {
            faceMeshesRef.current.push({ mesh: obj, index: dict[k] })
            found = true
            break
          }
        }

        if (!found) {
          const fallback = Object.keys(dict).find(k =>
            k.toLowerCase().includes('jaw') ||
            k.toLowerCase().includes('mouth') ||
            k.toLowerCase().includes('viseme')
          )
          if (fallback) {
            faceMeshesRef.current.push({ mesh: obj, index: dict[fallback] })
          }
        }
      }
    })

    if (faceMeshesRef.current.length === 0) {
      console.warn("❌ No meshes with mouth morph targets found.")
    }
  }, [scene])

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()

    // Idle breathing
    groupRef.current.position.y = -0.35 + Math.sin(t * 0.8) * 0.01

    // Listening lean
    const targetX = isListening && !isSpeaking ? -0.03 : 0
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetX,
      0.08
    )

    // Speaking pulse
    groupRef.current.scale.setScalar(
      isSpeaking ? 0.9 + Math.sin(t * 10) * 0.003 : 0.9
    )

    // RPM T-pose fix: rotate arms DOWN from horizontal to natural standing position
    // LeftShoulder: slight inward roll
    // RPM T-pose fix — arms need close to -PI/2 (=-1.57) to hang straight down
    if (leftShoulderRef.current) {
      leftShoulderRef.current.rotation.set(0, 0, 0.1)
    }
    if (rightShoulderRef.current) {
      rightShoulderRef.current.rotation.set(0, 0, -0.1)
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.set(0, 0, -2.75)  // nearly -PI/2 = straight down
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.set(0, 0, 2.75)   // mirrored
    }
    if (leftForearmRef.current) {
      leftForearmRef.current.rotation.set(0, 0, 0)
    }
    if (rightForearmRef.current) {
      rightForearmRef.current.rotation.set(0, 0, 0)
    }
    // Lip sync
    faceMeshesRef.current.forEach(({ mesh, index }) => {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[index] = mouth
      }
    })
  })

  return (
    <group ref={groupRef} position={[0, -0.35, 0]} scale={0.9}>
      <primitive object={scene} />
    </group>
  )
}

/* =========================
   PARTICLES
========================= */
function ParticleField() {
  const ref = useRef<THREE.Points>(null)
  const count = 160

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 6
      arr[i * 3 + 1] = Math.random() * 4
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6
    }
    return arr
  }, [])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.getElapsedTime() * 0.02
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        color="#94a3b8"
        opacity={0.35}
        transparent
      />
    </points>
  )
}

/* =========================
   MAIN SCENE
========================= */
interface Avatar3DProps {
  isSpeaking: boolean
  isListening: boolean
  audio: HTMLAudioElement | null
}

export default function Avatar3D({ isSpeaking, isListening, audio }: Avatar3DProps) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 1.05, 1.15], fov: 40 }}>
        <color attach="background" args={['#1a1a2e']} />
        <fog attach="fog" args={['#1a1a2e', 4, 12]} />

        <CameraRig />

        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 3]} intensity={1} castShadow />
        <directionalLight position={[-3, 5, -3]} intensity={0.7} />

        <Float speed={0.6} floatIntensity={0.05}>
          <GLBAvatar isSpeaking={isSpeaking} isListening={isListening} audio={audio} />
        </Float>

        <ParticleField />
        <Sparkles count={30} scale={6} size={1} speed={0.25} color="#cbd5e1" opacity={0.3} />

        <ContactShadows
          position={[0, -0.9, 0]}
          opacity={0.35}
          scale={6}
          blur={2}
          far={3}
          color="#94a3b8"
        />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          target={[0, 1.0, 0]}
          minPolarAngle={Math.PI / 2.5}
          maxPolarAngle={Math.PI / 1.8}
          minAzimuthAngle={-Math.PI / 6}
          maxAzimuthAngle={Math.PI / 6}
        />

        <Environment preset="night" />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/avatar.glb')