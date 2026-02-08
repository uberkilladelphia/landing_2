import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function NebulaBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 80)
    camera.position.z = 8

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight, false)

    const starCount = 1400
    const positions = new Float32Array(starCount * 3)
    const colors = new Float32Array(starCount * 3)
    const colorA = new THREE.Color('#6d7fa8')
    const colorB = new THREE.Color('#d4deff')

    for (let index = 0; index < starCount; index += 1) {
      const i3 = index * 3
      const radius = 7 + Math.random() * 8.2
      const angle = Math.random() * Math.PI * 2
      const height = (Math.random() - 0.5) * 8.6

      positions[i3] = Math.cos(angle) * radius
      positions[i3 + 1] = height
      positions[i3 + 2] = Math.sin(angle) * radius * 0.55

      const mix = Math.random()
      const tone = colorA.clone().lerp(colorB, mix)
      colors[i3] = tone.r
      colors[i3 + 1] = tone.g
      colors[i3 + 2] = tone.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.045,
        transparent: true,
        opacity: 0.44,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )

    scene.add(particles)

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 24, 24),
      new THREE.MeshBasicMaterial({
        color: '#15203a',
        transparent: true,
        opacity: 0.13,
      }),
    )
    halo.position.set(0, 0.25, -1.4)
    scene.add(halo)

    const pointer = { x: 0, y: 0 }
    const onPointerMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = -((event.clientY / window.innerHeight) * 2 - 1)
    }

    const onResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('resize', onResize)

    let animationId = 0

    const animate = (time) => {
      const t = time * 0.00015
      particles.rotation.y = t * 0.9
      particles.rotation.x = Math.sin(t * 0.6) * 0.12
      halo.rotation.y = -t * 0.45
      camera.position.x += (clamp(pointer.x * 0.32, -0.32, 0.32) - camera.position.x) * 0.04
      camera.position.y += (clamp(pointer.y * 0.24, -0.24, 0.24) - camera.position.y) * 0.04
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      animationId = window.requestAnimationFrame(animate)
    }

    animationId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(animationId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onResize)
      geometry.dispose()
      particles.material.dispose()
      halo.geometry.dispose()
      halo.material.dispose()
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="nebula-canvas" aria-hidden="true" />
}

export default NebulaBackground
