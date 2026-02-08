import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { profiles as sourceProfiles } from './data/profiles'
import SparkParticles from './components/SparkParticles'
import './App.css'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const wrapIndex = (value, length) => (value + length) % length

const circularOffset = (index, activeIndex, total) => {
  let delta = index - activeIndex
  if (delta > total / 2) delta -= total
  if (delta < -total / 2) delta += total
  return delta
}

const touchDistance = (touchA, touchB) => {
  const deltaX = touchA.clientX - touchB.clientX
  const deltaY = touchA.clientY - touchB.clientY
  return Math.hypot(deltaX, deltaY)
}

const placeholderSvg = (label) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111723"/>
          <stop offset="50%" stop-color="#1a2436"/>
          <stop offset="100%" stop-color="#0f141f"/>
        </linearGradient>
      </defs>
      <rect width="640" height="800" fill="url(#g)"/>
      <circle cx="320" cy="290" r="130" fill="rgba(240,245,255,0.08)"/>
      <rect x="140" y="460" width="360" height="170" rx="24" fill="rgba(240,245,255,0.08)"/>
      <text x="320" y="730" font-family="Manrope, sans-serif" text-anchor="middle" fill="rgba(240,245,255,0.55)" font-size="34" letter-spacing="2">${label}</text>
    </svg>`,
  )}`

const withBaseUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

const demoPhotoPath = withBaseUrl('profiles/9onAOMikXaE-film.jpg')
const demoPhotoPosition = '50% 50%'

const gaussianRandom = () => {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const buildGaussianNoiseTexture = (size = 192) => {
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return ''

  const imageData = context.createImageData(size, size)
  const { data } = imageData

  for (let i = 0; i < data.length; i += 4) {
    const sample = gaussianRandom()
    const tone = clamp(Math.round(128 + sample * 24), 0, 255)
    const alpha = clamp(Math.round(26 + Math.abs(sample) * 20), 10, 46)
    data[i] = tone
    data[i + 1] = tone
    data[i + 2] = tone
    data[i + 3] = alpha
  }

  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function App() {
  const profiles = useMemo(
    () =>
      sourceProfiles.map((profile) => ({
        ...profile,
        photo: demoPhotoPath,
        photoPosition: demoPhotoPosition,
        placeholder: placeholderSvg(profile.name),
      })),
    [],
  )
  const noiseTexture = useMemo(() => buildGaussianNoiseTexture(220), [])

  const totalProfiles = profiles.length
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoomScale, setZoomScale] = useState(1)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailIndex, setDetailIndex] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight)
  const [imageErrorMap, setImageErrorMap] = useState({})

  const cardRefs = useRef([])
  const openRectRef = useRef(null)
  const dragRef = useRef({ active: false, startX: 0, deltaX: 0, startTarget: null })
  const touchRef = useRef({
    mode: null,
    startX: 0,
    lastX: 0,
    startDistance: 0,
    startScale: 1,
    startTarget: null,
  })

  const detailLayerRef = useRef(null)
  const detailPhotoRef = useRef(null)
  const detailPhotoShellRef = useRef(null)
  const detailTextRef = useRef(null)
  const initializedRef = useRef(false)

  const cardWidthReference = clamp(viewportWidth * 0.3, 260, 500)
  const baseGap = clamp(viewportWidth * 0.08, 96, 210)
  const cardSpacing = ((cardWidthReference + baseGap * 3) / 2) * 1.7
  const sideScale = viewportWidth < 900 ? 0.88 : 0.92
  const trackTop = viewportHeight < 760 ? 56 : viewportHeight < 940 ? 54 : 53
  const activeRise = viewportWidth < 760 ? -32 : -48
  const sideDropLeft = viewportWidth < 760 ? 30 : 44
  const sideDropRight = viewportWidth < 760 ? 10 : 18

  const shiftCarousel = useCallback(
    (direction) => {
      if (isDetailOpen) return
      setZoomScale(1)
      setActiveIndex((index) => wrapIndex(index + direction, totalProfiles))
    },
    [isDetailOpen, totalProfiles],
  )

  const animateCards = useCallback(
    (duration = 0.9) => {
      profiles.forEach((_, index) => {
        const element = cardRefs.current[index]
        if (!element) return

        const media = element.querySelector('.card-media')
        const offset = circularOffset(index, activeIndex, totalProfiles)
        const distance = Math.abs(offset)
        const isActive = offset === 0
        const sideY = offset < 0 ? sideDropLeft : sideDropRight
        const tiltY = isActive ? 0 : offset < 0 ? 8 : -8
        const tiltZ = isActive ? 0 : offset < 0 ? -1.2 : 1.2
        const isInMotionWindow = distance <= 2

        if (!isInMotionWindow) {
          const parkedX = offset < 0 ? -cardSpacing * 2.6 : cardSpacing * 2.6
          gsap.set(element, {
            xPercent: -50,
            yPercent: -50,
            left: '50%',
            top: `${trackTop}%`,
            x: parkedX,
            y: sideY,
            scale: sideScale,
            rotationY: tiltY,
            rotationZ: tiltZ,
            transformPerspective: 1400,
            opacity: 1,
            pointerEvents: 'none',
            zIndex: 1,
          })

          if (media) {
            gsap.set(media, { filter: 'blur(0px) brightness(0.8)' })
          }
          return
        }

        gsap.to(element, {
          duration,
          xPercent: -50,
          yPercent: -50,
          left: '50%',
          top: `${trackTop}%`,
          x: offset * cardSpacing,
          y: isActive ? activeRise : sideY,
          scale: isActive ? 1.14 : sideScale,
          rotationY: tiltY,
          rotationZ: tiltZ,
          transformPerspective: 1400,
          opacity: 1,
          pointerEvents: isActive ? 'auto' : 'none',
          zIndex: 100 - distance * 12,
          ease: 'power2.inOut',
        })

        if (media) {
          gsap.to(media, {
            duration,
            filter: isActive
              ? 'blur(0px) brightness(1)'
              : 'blur(0px) brightness(0.8)',
            ease: 'power2.inOut',
          })
        }
      })
    },
    [
      activeIndex,
      activeRise,
      cardSpacing,
      profiles,
      sideDropLeft,
      sideDropRight,
      sideScale,
      totalProfiles,
      trackTop,
    ],
  )

  const openDetail = useCallback(() => {
    if (isDetailOpen) return
    const activeCard = cardRefs.current[activeIndex]
    const sourcePhoto = activeCard?.querySelector('.card-media')
    if (!sourcePhoto) return
    openRectRef.current = sourcePhoto.getBoundingClientRect()
    setDetailIndex(activeIndex)
    setIsDetailOpen(true)
  }, [activeIndex, isDetailOpen])

  const closeDetail = useCallback(() => {
    if (!isDetailOpen) return
    const detailPhoto = detailPhotoRef.current
    const detailPhotoShell = detailPhotoShellRef.current
    const detailText = detailTextRef.current
    const destination = cardRefs.current[activeIndex]?.querySelector('.card-media')
    const destinationRect = destination?.getBoundingClientRect()
    const shellRect = detailPhotoShell?.getBoundingClientRect()

    const timeline = gsap.timeline({
      onComplete: () => {
        setIsDetailOpen(false)
      },
    })

    if (detailText) {
      timeline.to(detailText, {
        y: 90,
        opacity: 0,
        duration: 0.26,
        ease: 'power2.in',
      })
    }

    if (detailPhotoShell && destinationRect && shellRect) {
      timeline.to(
        detailPhotoShell,
        {
          x: destinationRect.left - shellRect.left,
          y: destinationRect.top - shellRect.top,
          scaleX: destinationRect.width / shellRect.width,
          scaleY: destinationRect.height / shellRect.height,
          transformOrigin: 'top left',
          duration: 0.56,
          ease: 'power4.in',
        },
        0,
      )
    } else if (detailPhotoShell || detailPhoto) {
      timeline.to(
        detailPhotoShell || detailPhoto,
        {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.in',
        },
        0,
      )
    }
  }, [activeIndex, isDetailOpen])

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth)
      setViewportHeight(window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const resetDrag = () => {
      dragRef.current.active = false
      dragRef.current.deltaX = 0
      dragRef.current.startTarget = null
    }

    window.addEventListener('pointerup', resetDrag)
    window.addEventListener('pointercancel', resetDrag)

    return () => {
      window.removeEventListener('pointerup', resetDrag)
      window.removeEventListener('pointercancel', resetDrag)
    }
  }, [])

  useEffect(() => {
    if (isDetailOpen) return
    animateCards()
  }, [activeIndex, animateCards, isDetailOpen, viewportWidth])

  useLayoutEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    animateCards(0)
  }, [animateCards])

  useLayoutEffect(() => {
    if (!isDetailOpen) return
    const detailLayer = detailLayerRef.current
    const detailPhotoShell = detailPhotoShellRef.current
    const detailText = detailTextRef.current
    if (!detailLayer || !detailPhotoShell || !detailText) return

    // Close animation leaves transforms on the shell; reset them so each open
    // starts from the true layout position and animates consistently.
    gsap.set(detailPhotoShell, {
      clearProps: 'x,y,scaleX,scaleY,rotation,rotationX,rotationY,opacity',
    })

    const startRect = openRectRef.current
    const targetRect = detailPhotoShell.getBoundingClientRect()

    const timeline = gsap.timeline()

    if (startRect) {
      timeline.fromTo(
        detailPhotoShell,
        {
          x: startRect.left - targetRect.left,
          y: startRect.top - targetRect.top,
          scaleX: startRect.width / targetRect.width,
          scaleY: startRect.height / targetRect.height,
          transformOrigin: 'top left',
        },
        {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 0.88,
          ease: 'power4.out',
        },
      )
    } else {
      timeline.fromTo(
        detailPhotoShell,
        {
          x: 100,
          opacity: 0.45,
          scale: 0.84,
        },
        {
          x: 0,
          opacity: 1,
          scale: 1,
          duration: 0.68,
          ease: 'power3.out',
        },
      )
    }

    timeline.fromTo(
      detailText,
      {
        y: 84,
        opacity: 0,
      },
      {
        y: 0,
        opacity: 1,
        duration: 0.74,
        ease: 'power3.out',
      },
      '-=0.45',
    )

    return () => timeline.kill()
  }, [detailIndex, isDetailOpen])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') shiftCarousel(-1)
      if (event.key === 'ArrowRight') shiftCarousel(1)
      if (event.key === 'Escape') closeDetail()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeDetail, shiftCarousel])

  const onPointerDown = (event) => {
    if (event.pointerType === 'touch' || isDetailOpen) return
    dragRef.current = {
      active: true,
      startX: event.clientX,
      deltaX: 0,
      startTarget: event.target,
    }
  }

  const onPointerMove = (event) => {
    if (!dragRef.current.active || isDetailOpen) return
    dragRef.current.deltaX = event.clientX - dragRef.current.startX
  }

  const onPointerUp = (event) => {
    if (!dragRef.current.active) return
    const { deltaX, startTarget } = dragRef.current
    dragRef.current.active = false
    dragRef.current.deltaX = 0
    dragRef.current.startTarget = null

    if (Math.abs(deltaX) > 56) {
      shiftCarousel(deltaX < 0 ? 1 : -1)
      return
    }

    if (event.type === 'pointerup' && startTarget instanceof Element) {
      const activeCard = startTarget.closest('.profile-card.is-active')
      if (activeCard) openDetail()
    }
  }

  const onTouchStart = (event) => {
    if (isDetailOpen) return

    if (event.touches.length === 2) {
      touchRef.current.mode = 'pinch'
      touchRef.current.startDistance = touchDistance(event.touches[0], event.touches[1])
      touchRef.current.startScale = zoomScale
      return
    }

    if (event.touches.length === 1) {
      touchRef.current.mode = 'swipe'
      touchRef.current.startX = event.touches[0].clientX
      touchRef.current.lastX = touchRef.current.startX
      touchRef.current.startTarget = event.target
    }
  }

  const onTouchMove = (event) => {
    if (isDetailOpen) return

    if (touchRef.current.mode === 'pinch' && event.touches.length === 2) {
      event.preventDefault()
      const currentDistance = touchDistance(event.touches[0], event.touches[1])
      const ratio = currentDistance / touchRef.current.startDistance
      const nextScale = clamp(touchRef.current.startScale * ratio, 1, 1.9)
      setZoomScale(nextScale)
      return
    }

    if (touchRef.current.mode === 'swipe' && event.touches.length === 1) {
      touchRef.current.lastX = event.touches[0].clientX
    }
  }

  const onTouchEnd = () => {
    if (touchRef.current.mode === 'swipe') {
      const swipeDelta = touchRef.current.lastX - touchRef.current.startX
      if (Math.abs(swipeDelta) > 52) {
        shiftCarousel(swipeDelta < 0 ? 1 : -1)
      } else if (touchRef.current.startTarget instanceof Element) {
        const activeCard = touchRef.current.startTarget.closest('.profile-card.is-active')
        if (activeCard) openDetail()
      }
    }

    if (touchRef.current.mode === 'pinch') {
      setZoomScale((value) => clamp(value, 1, 1.9))
    }

    touchRef.current.mode = null
    touchRef.current.startTarget = null
  }

  const detailProfile = profiles[detailIndex]

  return (
    <main
      className="landing"
      style={{ '--noise-texture': noiseTexture ? `url("${noiseTexture}")` : 'none' }}
    >
      <SparkParticles />
      <div className="edge-fx edge-fx-blur" aria-hidden="true">
        <span className="edge-blur edge-blur-left" />
        <span className="edge-blur edge-blur-right" />
        <span className="edge-blur edge-blur-top" />
        <span className="edge-blur edge-blur-bottom" />
      </div>

      <section className="carousel-shell">
        <header className="top-bar">
          <p className="kicker">Кинетическая карусель профилей</p>
          <h1 className="main-title">Студенты и исследователи</h1>
        </header>

        <div
          className="carousel-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {profiles.map((profile, index) => {
            const isActive = index === activeIndex
            return (
              <article
                key={profile.id}
                ref={(element) => {
                  cardRefs.current[index] = element
                }}
                className={`profile-card ${isActive ? 'is-active' : ''}`}
              >
                <div className="card-media">
                  <img
                    className="card-photo"
                    src={imageErrorMap[index] ? profile.placeholder : profile.photo}
                    alt={profile.name}
                    style={{
                      '--zoom': isActive ? zoomScale : 1,
                      objectPosition: profile.photoPosition,
                    }}
                    onError={() => setImageErrorMap((map) => ({ ...map, [index]: true }))}
                  />
                </div>
                <div className="card-meta">
                  <span>{profile.name}</span>
                  <sup className="card-uni">{profile.university}</sup>
                </div>
              </article>
            )
          })}
        </div>

        <footer className="controls">
          <div className="azimuth" role="tablist" aria-label="Индикатор активного профиля">
            {profiles.map((profile, index) => (
              <button
                key={profile.id}
                type="button"
                role="tab"
                className={`azimuth-bar ${index === activeIndex ? 'is-active' : ''}`}
                aria-selected={index === activeIndex}
                aria-label={`Профиль ${index + 1}`}
                onClick={() => {
                  if (isDetailOpen) return
                  setZoomScale(1)
                  setActiveIndex(index)
                }}
              />
            ))}
          </div>
          <div className="buttons">
            <button
              type="button"
              className="nav-arrow"
              aria-label="Предыдущий профиль"
              onClick={() => shiftCarousel(-1)}
              disabled={isDetailOpen}
            >
              ←
            </button>
            <button
              type="button"
              className="nav-arrow"
              aria-label="Следующий профиль"
              onClick={() => shiftCarousel(1)}
              disabled={isDetailOpen}
            >
              →
            </button>
          </div>
        </footer>
      </section>

      <section
        ref={detailLayerRef}
        className={`detail-layer ${isDetailOpen ? 'is-open' : ''}`}
        aria-hidden={!isDetailOpen}
      >
        <button className="close-detail" type="button" onClick={closeDetail}>
          Закрыть
        </button>
        {detailProfile && (
          <div className="detail-inner">
            <div className="detail-photo-shell">
              <div ref={detailPhotoShellRef} className="detail-photo-shell-inner">
                <img
                  ref={detailPhotoRef}
                  className="detail-photo"
                  src={imageErrorMap[detailIndex] ? detailProfile.placeholder : detailProfile.photo}
                  alt={detailProfile.name}
                  style={{ objectPosition: detailProfile.photoPosition }}
                  onError={() => setImageErrorMap((map) => ({ ...map, [detailIndex]: true }))}
                />
              </div>
            </div>

            <article ref={detailTextRef} className="detail-text">
              <h2>{detailProfile.title}</h2>
              <h3>{detailProfile.subtitle}</h3>
              <p>{detailProfile.body}</p>
              <ul>
                {detailProfile.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
