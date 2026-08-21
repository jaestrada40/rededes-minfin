import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SocialIcon, WordPressIcon } from './OfficialLogos';
import { 
  Plus, 
  HelpCircle, 
  Link2, 
  CheckCircle2, 
  ArrowUp, 
  ArrowDown, 
  Trash2,
  Ban,
  Edit3, 
  Eye, 
  ExternalLink, 
  Globe, 
  Copy, 
  Check, 
  AlertCircle,
  GripVertical,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Share2
} from 'lucide-react';
import { SocialNetworkType, SocialPost } from '../types';

interface FeedDetailViewProps {
  onOpenAssignModal: (feedId: string) => void;
}

export const FeedDetailView: React.FC<FeedDetailViewProps> = ({ onOpenAssignModal }) => {
  const {
    feeds,
    posts,
    selectedFeedId,
    setSelectedFeedId,
    setActiveTab,
    addPost,
    removePostFromFeed,
    deletePostPermanently,
    reorderPostsInFeed,
    updatePostContent,
    openFeedPreview,
    settings,
    requestConfirm,
    user
  } = useApp();

  const currentFeed = feeds.find(f => f.id === selectedFeedId) || feeds[0];
  const [activeNetworkTab, setActiveNetworkTab] = useState<SocialNetworkType>(
    (currentFeed?.network !== 'mixed' ? (currentFeed?.network as SocialNetworkType) : 'x') || 'x'
  );

  const [inputUrlOrId, setInputUrlOrId] = useState('');
  const [customText, setCustomText] = useState('');
  const [customMediaUrl, setCustomMediaUrl] = useState('');
  const [customAuthorName, setCustomAuthorName] = useState('');
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContentText, setEditContentText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = user.role === 'admin' || user.role === 'editor';

  // Get posts for this feed in proper sequence
  const feedPosts = (currentFeed?.postIds || [])
    .map(id => posts.find(p => p.id === id))
    .filter((p): p is SocialPost => p !== undefined);

  const officialAccount = settings.officialAccounts[activeNetworkTab];

  const getExamplePlaceholder = (network: SocialNetworkType) => {
    switch (network) {
      case 'x':
        return 'Ej: https://x.com/MinfinGT/status/1892837461928472910 o ID 1892837461928472910';
      case 'facebook':
        return 'Ej: https://www.facebook.com/minfin.gt/posts/pfbid02KnM9QxLz18Rk3j o ID pfbid02KnM9QxLz';
      case 'instagram':
        return 'Ej: https://www.instagram.com/p/DF3k9L1pQr8/ o ID DF3k9L1pQr8';
      case 'youtube':
        return 'Ej: https://www.youtube.com/watch?v=dQw4w9WgXcQ o ID dQw4w9WgXcQ';
      case 'linkedin':
        return 'Ej: https://www.linkedin.com/feed/update/urn:li:activity:7298374619283746192/ o ID 7298374619283746192';
      case 'tiktok':
        return 'Ej: https://www.tiktok.com/@minfingua/video/7392819283746192837 o ID 7392819283746192837';
      default:
        return 'Pegue la URL completa o el ID de la publicación';
    }
  };

  const handleAddPostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!inputUrlOrId.trim()) {
      setErrorMessage('Por favor ingrese una URL o ID de publicación.');
      return;
    }

    const result = await addPost(currentFeed.id, {
      urlOrId: inputUrlOrId,
      network: activeNetworkTab,
      customContent: customText.trim() ? customText : undefined,
      customMediaUrl: customMediaUrl.trim() ? customMediaUrl.trim() : undefined,
      customAuthorName: customAuthorName.trim() ? customAuthorName.trim() : undefined
    });

    if (!result.success) {
      setErrorMessage(result.message);
    } else {
      setInputUrlOrId('');
      setCustomText('');
      setCustomMediaUrl('');
      setCustomAuthorName('');
    }
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      reorderPostsInFeed(currentFeed.id, index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < feedPosts.length - 1) {
      reorderPostsInFeed(currentFeed.id, index, index + 1);
    }
  };

  const handleSaveEdit = (postId: string) => {
    updatePostContent(postId, editContentText);
    setEditingPostId(null);
  };

  const handleCopyShortcode = () => {
    if (!currentFeed) return;
    const code = `[${settings.shortcodeTag} feed="${currentFeed.slug}"]`;
    navigator.clipboard.writeText(code);
    setCopiedId('shortcode');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!currentFeed) {
    return (
      <div className="max-w-2xl mx-auto text-center bg-white p-10 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <Layers className="w-10 h-10 text-slate-300 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Aún no hay feeds creados</h2>
        <p className="text-sm text-slate-500">
          Cree su primer feed institucional para poder registrar publicaciones aquí.
        </p>
        <button
          onClick={() => setActiveTab('feeds')}
          className="inline-flex items-center gap-2 bg-[#0072ce] hover:bg-[#005fb0] text-white font-medium px-4 py-2 rounded-lg text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ir a Gestión de Feeds</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Bar: Feed Selector & Overview Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#003876] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Detalle y Registro de Contenido
            </span>
            <span className="text-xs text-slate-500">
              Feed ID: <span className="font-mono text-slate-700 font-semibold">{currentFeed?.slug}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#003876]">
              {currentFeed?.name}
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {currentFeed?.status === 'active' ? 'En línea' : currentFeed?.status}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            {currentFeed?.description}
          </p>
        </div>

        {/* Action Controls & Feed Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Feed Switcher Dropdown */}
          <select
            value={currentFeed?.id}
            onChange={(e) => setSelectedFeedId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-slate-800 font-medium focus:outline-none focus:border-[#003876] cursor-pointer"
          >
            {feeds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.postIds.length} posts)
              </option>
            ))}
          </select>

          <button
            onClick={handleCopyShortcode}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 transition-colors cursor-pointer"
            title="Copiar shortcode institucional"
          >
            {copiedId === 'shortcode' ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Copiado
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="w-3.5 h-3.5" /> [Shortcode]
              </span>
            )}
          </button>

          <button
            onClick={() => onOpenAssignModal(currentFeed.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-[#003876] rounded-lg border border-blue-200 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Portales ({currentFeed?.assignedPortalIds.length})</span>
          </button>

          <button
            onClick={() => openFeedPreview(currentFeed.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#003876] hover:bg-[#002d5e] rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Vista Previa Pública</span>
          </button>
        </div>
      </div>

      {/* Main Social Network Tabs Form (Inspired by User Requirement) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Network Selection Tabs */}
        <div className="bg-[#003876] px-4 pt-3 flex items-center gap-1 overflow-x-auto border-b border-[#002d5e]">
          {(['x', 'facebook', 'instagram', 'youtube', 'linkedin', 'tiktok'] as SocialNetworkType[]).map((net) => {
            const isActive = activeNetworkTab === net;
            const labels: Record<SocialNetworkType, string> = {
              x: 'X (Twitter)',
              facebook: 'Facebook',
              instagram: 'Instagram',
              youtube: 'YouTube',
              linkedin: 'LinkedIn',
              tiktok: 'TikTok'
            };

            return (
              <button
                key={net}
                onClick={() => setActiveNetworkTab(net)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-[#003876] border-t-2 border-[#0072ce] shadow-xs'
                    : 'text-blue-100 hover:text-white hover:bg-[#002d5e]'
                }`}
              >
                <SocialIcon network={net} size={15} colored={isActive} />
                <span>{labels[net]}</span>
              </button>
            );
          })}
        </div>

        {/* Input Form Body */}
        <div className="p-4 sm:p-6 bg-slate-50/50">
          <form onSubmit={handleAddPostSubmit} className="space-y-4">
            {/* Account Info and Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Account Handle Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Usuario o Cuenta Oficial
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={officialAccount?.handle || '@MinfinGT'}
                    className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg py-2 px-3 text-slate-800 shadow-xs"
                  />
                  {officialAccount?.url && (
                    <a
                      href={officialAccount.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#003876] hover:text-blue-800 p-1"
                      title="Abrir perfil oficial"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Cuenta verificada por la Dirección de Comunicación Social.
                </span>
              </div>

              {/* URL or Post ID Field (2 cols) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  URL Completa o ID de la Publicación
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inputUrlOrId}
                      onChange={(e) => setInputUrlOrId(e.target.value)}
                      placeholder={getExamplePlaceholder(activeNetworkTab)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003876] focus:ring-1 focus:ring-[#003876] shadow-xs font-mono"
                    />
                  </div>

                  {canEdit && (
                    <button
                      type="submit"
                      id="btn-add-post-to-feed"
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#003876] hover:bg-[#002d5e] active:bg-[#002247] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Publicación</span>
                    </button>
                  )}
                </div>

                {/* Institutional Helper Box (Strictly matching user requirement) */}
                <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#003876] shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong>Instrucción oficial:</strong> Pegue la URL completa o el ID de la publicación. El sistema reconocerá el identificador automáticamente cuando sea posible.
                    {activeNetworkTab === 'x' && (
                      <span className="block mt-0.5 text-blue-900 font-mono">
                        Ejemplo para X: <code className="bg-blue-100/80 px-1 rounded">https://x.com/MinfinGT/status/1892837461928472910</code> o ID <code className="bg-blue-100/80 px-1 rounded">1892837461928472910</code>
                      </span>
                    )}
                  </div>
                </div>

                {errorMessage && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom content override — useful when the platform doesn't expose real data (X, Instagram, LinkedIn) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCustomFields(!showCustomFields)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                {showCustomFields ? '− Ocultar contenido personalizado' : '+ Pegar contenido real manualmente (texto, imagen, autor)'}
              </button>

              {showCustomFields && (
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Texto real de la publicación
                    </label>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={2}
                      placeholder="Pegue aquí el texto exacto de la publicación original"
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003876] resize-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      URL de la imagen
                    </label>
                    <input
                      type="text"
                      value={customMediaUrl}
                      onChange={(e) => setCustomMediaUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003876] font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Nombre del autor
                    </label>
                    <input
                      type="text"
                      value={customAuthorName}
                      onChange={(e) => setCustomAuthorName(e.target.value)}
                      placeholder="Ministerio de..."
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#003876]"
                    />
                  </div>
                  <p className="md:col-span-3 text-[11px] text-slate-500">
                    Úselo cuando la red social no permita obtener el contenido real automáticamente (X, Instagram,
                    LinkedIn). YouTube, TikTok y Facebook (con token configurado) ya lo obtienen solos.
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Posts Table / Cards with Reordering and Live Preview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-[#003876] uppercase tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#0072ce]" />
              <span>Publicaciones Registradas en este Feed ({feedPosts.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Ordene las publicaciones arrastrando o utilizando las flechas. La primera publicación será la más visible en los portales WordPress.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Sincronización instantánea activa</span>
          </div>
        </div>

        {feedPosts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Layers className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">
              No hay publicaciones asignadas a este feed.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Utilice el formulario superior seleccionando la red social correspondiente e ingrese el ID o URL de la publicación oficial.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {feedPosts.map((post, index) => {
              const isEditing = editingPostId === post.id;

              return (
                <div 
                  key={post.id} 
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Reorder Handles & Post Details */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Order buttons */}
                    <div className="flex flex-col items-center justify-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0 || !canEdit}
                        className="p-1 text-slate-600 hover:text-blue-700 hover:bg-white rounded disabled:opacity-30 cursor-pointer"
                        title="Subir posición"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-bold font-mono text-slate-700 px-1">
                        #{index + 1}
                      </span>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === feedPosts.length - 1 || !canEdit}
                        className="p-1 text-slate-600 hover:text-blue-700 hover:bg-white rounded disabled:opacity-30 cursor-pointer"
                        title="Bajar posición"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Media Thumbnail if available */}
                    {post.mediaUrl || post.mediaThumb ? (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 relative">
                        <img
                          src={post.mediaUrl || post.mediaThumb}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-1 left-1 p-1 bg-black/70 rounded text-white">
                          <SocialIcon network={post.network} size={11} />
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <SocialIcon network={post.network} size={24} />
                      </div>
                    )}

                    {/* Post Content & Meta */}
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#003876] text-white flex items-center gap-1">
                          <SocialIcon network={post.network} size={10} colored={false} />
                          <span className="uppercase">{post.network}</span>
                        </span>

                        <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          ID: {post.postId}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Validada DTI
                        </span>

                        <span className="text-[10px] text-slate-500">
                          {post.publishedAt}
                        </span>
                      </div>

                      {/* Content Edit Form or View */}
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editContentText}
                            onChange={(e) => setEditContentText(e.target.value)}
                            rows={3}
                            className="w-full text-xs p-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(post.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded cursor-pointer"
                            >
                              Guardar Cambios
                            </button>
                            <button
                              onClick={() => setEditingPostId(null)}
                              className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium rounded cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                          {post.content}
                        </p>
                      )}

                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 font-mono text-[10px]"
                        >
                          <span>Ver enlace original</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <span>·</span>
                        <span>Registrado por: {post.addedBy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center justify-end gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                    <button
                      onClick={() => {
                        setEditingPostId(post.id);
                        setEditContentText(post.content);
                      }}
                      disabled={!canEdit}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer disabled:opacity-40"
                      title="Editar texto de vista previa"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {canEdit && (
                      <button
                        onClick={async () => {
                          const ok = await requestConfirm(
                            `¿Confirma eliminar la publicación ${post.postId} de este feed? Los portales WordPress se actualizarán inmediatamente.`,
                            { title: 'Eliminar publicación', confirmLabel: 'Eliminar', danger: true }
                          );
                          if (ok) removePostFromFeed(currentFeed.id, post.id);
                        }}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-slate-200 cursor-pointer"
                        title="Eliminar del feed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {user.role === 'admin' && (
                      <button
                        onClick={async () => {
                          const ok = await requestConfirm(
                            `¿Eliminar permanentemente la publicación ${post.postId} de la base de datos? Se quitará de todos los feeds donde esté vinculada. Úselo cuando el contenido guardado esté desactualizado — la próxima vez que agregue esta misma URL, el sistema volverá a buscar el contenido real.`,
                            { title: 'Eliminar de la base de datos', confirmLabel: 'Eliminar permanentemente', danger: true }
                          );
                          if (ok) deletePostPermanently(post.id);
                        }}
                        className="p-1.5 text-red-800 hover:text-white hover:bg-red-700 rounded border border-red-200 cursor-pointer"
                        title="Eliminar permanentemente de la base de datos (fuerza recarga de datos reales)"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
