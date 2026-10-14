'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import { mediaSrc } from '@/lib/format';
import type { GalleryImg } from '@/lib/magento/types';

export function galleryImages(list: GalleryImg[] | undefined | null, name: string) {
  return (list ?? [])
    .filter((g) => !g.disabled)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((g) => ({ src: mediaSrc(g.url), alt: g.label || name }))
    .filter((g): g is { src: string; alt: string } => !!g.src);
}

export function Gallery({ images, name, compact = false }: { images: { src: string; alt: string }[]; name: string; compact?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const single = images.length <= 1 || compact;
  const key = images.map((i) => i.src).join('|');

  // new image set (variant picked): back to the first photo
  useEffect(() => {
    setIdx(0);
    track.current?.scrollTo({ left: 0 });
  }, [key]);

  const goTo = (i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    setIdx(i);
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  };

  useEffect(() => {
    if (zoom === null) return;
    document.documentElement.classList.add('ts-locked');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null);
      if (e.key === 'ArrowRight') setZoom((z) => (z === null ? z : (z + 1) % images.length));
      if (e.key === 'ArrowLeft') setZoom((z) => (z === null ? z : (z - 1 + images.length) % images.length));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('ts-locked');
      window.removeEventListener('keydown', onKey);
    };
  }, [zoom, images.length]);

  if (!images.length) {
    return (
      <div className="ts-gallery ts-gallery--single">
        <div className="ts-gallery__stage" />
      </div>
    );
  }

  const shown = compact ? images.slice(0, 1) : images;

  return (
    <div className={`ts-gallery${single ? ' ts-gallery--single' : ''}`}>
      {!single && (
        <ul className="ts-gallery__thumbs" aria-label="Product photos">
          {images.map((im, i) => (
            <li key={im.src}>
              <button type="button" className={`ts-gallery__thumb${i === idx ? ' is-on' : ''}`} aria-label={`Show photo ${i + 1} of ${images.length}`} aria-current={i === idx} onClick={() => goTo(i)}>
                <Image src={im.src} alt="" width={128} height={160} sizes="128px" quality={70} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <div className="ts-gallery__stage">
          <div className="ts-gallery__track" ref={track} onScroll={onScroll}>
            {shown.map((im, i) => (
              <div className="ts-gallery__slide" key={im.src}>
                <Image
                  src={im.src}
                  alt={im.alt}
                  fill
                  sizes={compact ? '(max-width: 559px) 90vw, 460px' : '(max-width: 767px) 100vw, (max-width: 1023px) 720px, (max-width: 1320px) 44vw, 580px'}
                  priority={i === 0}
                  quality={80}
                />
                {!compact && (
                  <button type="button" className="ts-gallery__zoom" aria-label={`Enlarge photo ${i + 1}`} onClick={() => setZoom(i)} />
                )}
              </div>
            ))}
          </div>
        </div>
        {!single && (
          <div className="ts-gallery__dots">
            {images.map((im, i) => (
              <button type="button" key={im.src} className={i === idx ? 'is-on' : ''} aria-label={`Photo ${i + 1}`} onClick={() => goTo(i)} />
            ))}
          </div>
        )}
      </div>
      {zoom !== null &&
        createPortal(
          <div className="ts-lightbox" role="dialog" aria-modal="true" aria-label={`${name} photos`}>
            <button type="button" className="ts-icon-btn" aria-label="Close" onClick={() => setZoom(null)} autoFocus>
              <Icon name="close" />
            </button>
            {images.length > 1 && (
              <>
                <button type="button" className="ts-icon-btn ts-lightbox__nav ts-lightbox__nav--prev" aria-label="Previous photo" onClick={() => setZoom((zoom - 1 + images.length) % images.length)}>
                  <Icon name="chevL" />
                </button>
                <button type="button" className="ts-icon-btn ts-lightbox__nav ts-lightbox__nav--next" aria-label="Next photo" onClick={() => setZoom((zoom + 1) % images.length)}>
                  <Icon name="chevR" />
                </button>
              </>
            )}
            <Image src={images[zoom].src} alt={images[zoom].alt} width={1600} height={2000} sizes="100vw" quality={80} style={{ width: 'auto', height: '100dvh', maxWidth: '100%', objectFit: 'contain' }} />
          </div>,
          document.body,
        )}
    </div>
  );
}
