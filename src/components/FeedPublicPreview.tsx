import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SocialIcon, WordPressIcon, MinfinLogo } from './OfficialLogos';
import { 
  LayoutGrid, 
  List, 
  Sliders, 
  Maximize2, 
  Copy, 
  Check, 
  ExternalLink, 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Eye, 
  Share2, 
  Play, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Layers,
  Globe,
  Settings2,
  CheckCircle2
} from 'lucide-react';
import { SocialPost } from '../types';

export const FeedPublicPreview: React.FC = () => {
  const { feeds, posts, portals, selectedFeedId, setSelectedFeedId, settings } = useApp();

  const currentFeed = feeds.find(f => f.id === selectedFeedId) || feeds[0];

  // Preview Customization Controls
  const [layout, setLayout] = useState<'grid' | 'list' | 'carousel' | 'single'>(currentFeed?.layoutDefault || 'grid');
  const [itemsLimit, setItemsLimit] = useState<number>(currentFeed?.maxItemsDefault || 6);
  const [customTitle, setCustomTitle] = useState<string>(`Publicaciones Oficiales · ${currentFeed?.name || 'MINFIN'}`);
  const [showMetrics, setShowMetrics] = useState<boolean>(currentFeed?.showMetrics !== undefined ? currentFeed.showMetrics : true);
  const [showMedia, setShowMedia] = useState<boolean>(currentFeed?.showMedia !== undefined ? currentFeed.showMedia : true);
  const [showSeeMoreBtn, setShowSeeMoreBtn] = useState<boolean>(true);
  const [selectedPortalContext, setSelectedPortalContext] = useState<string>('wp-01');
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [copiedShortcode, setCopiedShortcode] = useState<boolean>(false);

  // Get posts for this feed
  const feedPosts = (currentFeed?.postIds || [])
    .map(id => posts.find(p => p.id === id))
    .filter((p): p is SocialPost => p !== undefined)
    .slice(0, itemsLimit);

  const portalContext = portals.find(p => p.id === selectedPortalContext) || portals[0];

  // Dynamic Shortcode with current layout parameters
  const dynamicShortcode = `[${settings.shortcodeTag} feed="${currentFeed?.slug}" layout="${layout}" limit="${itemsLimit}" metrics="${showMetrics}"]`;

  const handleCopyShortcode = () => {
    navigator.clipboard.writeText(dynamicShortcode);
    setCopiedShortcode(true);
    setTimeout(() => setCopiedShortcode(false), 2000);
  };

  const handleNextCarousel = () => {
    if (feedPosts.length > 0) {
      setCarouselIndex((prev) => (prev + 1) % feedPosts.length);
    }
  };

  const handlePrevCarousel = () => {
    if (feedPosts.length > 0) {
      setCarouselIndex((prev) => (prev - 1 + feedPosts.length) % feedPosts.length);
    }
  };

  // Render individual Social Card adhering to authentic brand styling
  const renderSocialCard = (post: SocialPost) => {
    const isX = post.network === 'x';
    const isFB = post.network === 'facebook';
    const isIG = post.network === 'instagram';
    const isYT = post.network === 'youtube';
    const isLI = post.network === 'linkedin';

    return (
      <div
        key={post.id}
        className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-300"
      >
        {/* Card Header: Author Profile */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className={`w-9 h-9 rounded-full overflow-hidden border ${isIG ? 'p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600' : 'bg-slate-100 border-slate-200'}`}>
                <img
                  src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=120&q=80"
                  alt="MINFIN"
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs text-slate-900 truncate">
                  {post.authorName}
                </span>
                <span className="text-blue-600 shrink-0" title="Cuenta Oficial Verificada">
                  <CheckCircle2 className="w-3.5 h-3.5 fill-blue-600 text-white" />
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">
                {post.authorHandle} · <span className="text-slate-400">{post.publishedAt}</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 p-1">
            <SocialIcon network={post.network} size={16} />
          </div>
        </div>

        {/* Card Body: Text Content */}
        <div className="p-3.5 sm:p-4 flex-1">
          <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
            {post.content}
          </p>
        </div>

        {/* Card Media if enabled */}
        {showMedia && (post.mediaUrl || post.mediaThumb) && (
          <div className="relative border-y border-slate-100 bg-slate-950 overflow-hidden max-h-60 sm:max-h-72">
            <img
              src={post.mediaUrl || post.mediaThumb}
              alt="Publicación MINFIN"
              className="w-full h-full object-cover max-h-60 sm:max-h-72"
              referrerPolicy="no-referrer"
            />
            {isYT && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </div>
                {post.videoDuration && (
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold">
                    {post.videoDuration}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Card Footer: Metrics & Links */}
        <div className="p-3 sm:px-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          {showMetrics ? (
            <div className="flex items-center gap-3 font-mono text-[10px]">
              {post.stats?.likes !== undefined && (
                <span className="flex items-center gap-1 text-slate-600 hover:text-rose-600">
                  <Heart className="w-3 h-3" /> {post.stats.likes}
                </span>
              )}
              {post.stats?.reposts !== undefined && (
                <span className="flex items-center gap-1 text-slate-600 hover:text-emerald-600">
                  <Repeat2 className="w-3 h-3" /> {post.stats.reposts}
                </span>
              )}
              {post.stats?.comments !== undefined && (
                <span className="flex items-center gap-1 text-slate-600 hover:text-blue-600">
                  <MessageCircle className="w-3 h-3" /> {post.stats.comments}
                </span>
              )}
              {post.stats?.views !== undefined && (
                <span className="hidden sm:flex items-center gap-1 text-slate-500">
                  <Eye className="w-3 h-3" /> {post.stats.views.toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 font-mono">MINFIN Oficial</span>
          )}

          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline flex items-center gap-1 font-semibold text-[11px]"
          >
            <span>Ver publicación</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#003876] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Simulador WordPress
            </span>
            <span className="text-xs text-slate-500">
              Visualice cómo se renderiza el shortcode
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#003876] mt-1">
            Vista Previa del Feed Embebido en Portales
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Compruebe la apariencia responsiva del feed con las plantillas oficiales de diseño antes de desplegarlo en los portales WordPress.
          </p>
        </div>

        {/* Dynamic shortcode copy box */}
        <div className="flex items-center gap-2 bg-[#003876] p-2 rounded-lg border border-blue-900 text-white shadow-xs">
          <code className="text-xs font-mono text-emerald-300 px-2 select-all">
            {dynamicShortcode}
          </code>
          <button
            onClick={handleCopyShortcode}
            className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition-colors border border-white/20"
          >
            {copiedShortcode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedShortcode ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* Control Panel for Layout Customization */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-xs uppercase text-[#003876] border-b border-slate-100 pb-2">
          <Settings2 className="w-4 h-4 text-[#003876]" />
          <span>Configuración Visual del Shortcode Embebido</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Feed Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Feed Seleccionado:
            </label>
            <select
              value={currentFeed?.id}
              onChange={(e) => setSelectedFeedId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium focus:outline-none focus:border-[#003876] cursor-pointer"
            >
              {feeds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.postIds.length} posts)
                </option>
              ))}
            </select>
          </div>

          {/* Layout Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Tipo de Disposición:
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'grid', label: 'Grid', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
                { id: 'list', label: 'Lista', icon: <List className="w-3.5 h-3.5" /> },
                { id: 'carousel', label: 'Slider', icon: <Sliders className="w-3.5 h-3.5" /> },
                { id: 'single', label: 'Único', icon: <Maximize2 className="w-3.5 h-3.5" /> }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLayout(m.id as any)}
                  className={`py-1.5 px-1 rounded flex flex-col items-center justify-center gap-0.5 border text-[11px] font-semibold cursor-pointer transition-colors ${
                    layout === m.id
                      ? 'bg-[#003876] text-white border-[#003876]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Portal Context Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Portal WordPress de Prueba:
            </label>
            <select
              value={selectedPortalContext}
              onChange={(e) => setSelectedPortalContext(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium focus:outline-none focus:border-[#003876] cursor-pointer"
            >
              {portals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.domain})
                </option>
              ))}
            </select>
          </div>

          {/* Limits & Options */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Cantidad Máx. de Posts:
            </label>
            <select
              value={itemsLimit}
              onChange={(e) => setItemsLimit(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium focus:outline-none focus:border-[#003876] cursor-pointer"
            >
              <option value={3}>3 publicaciones</option>
              <option value={4}>4 publicaciones</option>
              <option value={6}>6 publicaciones</option>
              <option value={8}>8 publicaciones</option>
              <option value={12}>12 publicaciones</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showMetrics}
              onChange={(e) => setShowMetrics(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span>Mostrar estadísticas de interacción</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showMedia}
              onChange={(e) => setShowMedia(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span>Mostrar fotos y videos adjuntos</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700">
            <input
              type="checkbox"
              checked={showSeeMoreBtn}
              onChange={(e) => setShowSeeMoreBtn(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span>Botón institucional "Ver más en canal oficial"</span>
          </label>
        </div>
      </div>

      {/* Simulated WordPress Portal Window */}
      <div className="bg-slate-100 rounded-xl border border-slate-300 shadow-md overflow-hidden">
        {/* Simulated Browser Bar */}
        <div className="bg-[#003876] px-4 py-2.5 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-[11px] font-mono text-slate-200 bg-[#002754] px-3 py-0.5 rounded border border-blue-900/60">
              https://{portalContext.domain}/seccion-comunicados/
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-blue-100">
            <WordPressIcon size={14} />
            <span>{portalContext.name}</span>
          </div>
        </div>

        {/* Simulated Portal Canvas */}
        <div className="p-4 sm:p-8 bg-white min-h-[400px]">
          {/* Simulated WordPress Content Page Wrapper */}
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Feed Section Header */}
            <div className="border-b-2 border-[#003876] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#003876] text-white">
                  <SocialIcon network={currentFeed?.network || 'x'} size={18} colored={false} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#003876] uppercase tracking-tight">
                    {customTitle}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Contenido oficial verificado y sincronizado desde la red institucional
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#003876]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Actualizado en tiempo real</span>
              </div>
            </div>

            {/* Render Posts according to selected layout */}
            {feedPosts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                No hay publicaciones registradas para previsualizar en este feed.
              </div>
            ) : layout === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {feedPosts.map(renderSocialCard)}
              </div>
            ) : layout === 'list' ? (
              <div className="max-w-2xl mx-auto space-y-4">
                {feedPosts.map(renderSocialCard)}
              </div>
            ) : layout === 'carousel' ? (
              <div className="relative max-w-xl mx-auto py-2">
                {feedPosts[carouselIndex] && renderSocialCard(feedPosts[carouselIndex])}

                {/* Carousel Controls */}
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={handlePrevCarousel}
                    className="p-2 rounded-full bg-[#003876] text-white hover:bg-[#002d5e] shadow cursor-pointer transition-colors"
                    aria-label="Anterior publicación"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Dots */}
                  <div className="flex items-center gap-1.5">
                    {feedPosts.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCarouselIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                          carouselIndex === idx ? 'bg-[#003876] w-6' : 'bg-slate-300 hover:bg-slate-400'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleNextCarousel}
                    className="p-2 rounded-full bg-[#003876] text-white hover:bg-[#002d5e] shadow cursor-pointer transition-colors"
                    aria-label="Siguiente publicación"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              // Single featured post
              <div className="max-w-xl mx-auto">
                {feedPosts[0] && renderSocialCard(feedPosts[0])}
              </div>
            )}

            {/* Optional Institutional "Ver Más" Button */}
            {showSeeMoreBtn && (
              <div className="text-center pt-4 border-t border-slate-100">
                <a
                  href="https://x.com/MinfinGT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#003876] text-white hover:bg-[#002d5e] font-bold text-xs shadow transition-colors cursor-pointer"
                >
                  <SocialIcon network={currentFeed?.network || 'x'} size={14} colored={false} />
                  <span>Ver todas las publicaciones en canal oficial de MINFIN</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
