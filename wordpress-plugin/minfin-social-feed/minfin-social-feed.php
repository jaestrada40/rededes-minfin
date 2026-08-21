<?php
/**
 * Plugin Name: MINFIN Social Feed
 * Description: Muestra feeds de redes sociales institucionales del MINFIN administrados desde el Gestor Centralizado de Redes Sociales, vía shortcode.
 * Version: 1.0.0
 * Author: DTI - Ministerio de Finanzas Públicas
 * Text Domain: minfin-social-feed
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MINFIN_SOCIAL_FEED_VERSION', '1.0.0');
define('MINFIN_SOCIAL_FEED_OPTION', 'minfin_social_feed_settings');

class Minfin_Social_Feed {

    public function __construct() {
        add_action('admin_menu', [$this, 'register_settings_page']);
        add_action('admin_init', [$this, 'register_settings']);
        add_shortcode('minfin_social_feed', [$this, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_styles']);
        add_action('wp_ajax_minfin_test_connection', [$this, 'ajax_test_connection']);
    }

    public function ajax_test_connection() {
        check_ajax_referer('minfin_test_connection', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'No autorizado.'], 403);
        }

        $api_url = isset($_POST['api_url']) ? untrailingslashit(esc_url_raw(wp_unslash($_POST['api_url']))) : '';
        if (empty($api_url)) {
            wp_send_json_error(['message' => 'Ingrese una URL antes de probar la conexión.']);
        }

        $response = wp_remote_get($api_url . '/public/branding', ['timeout' => 8]);

        if (is_wp_error($response)) {
            wp_send_json_error(['message' => $response->get_error_message()]);
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code !== 200) {
            wp_send_json_error(['message' => 'La API respondió con el código ' . $code . '. Verifique la URL.']);
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        $name = is_array($body) && !empty($body['institutionName']) ? $body['institutionName'] : null;

        wp_send_json_success([
            'message' => $name
                ? 'Conectado correctamente a "' . $name . '".'
                : 'Conectado correctamente.',
        ]);
    }

    public function enqueue_styles() {
        wp_register_style('minfin-social-feed', false, [], MINFIN_SOCIAL_FEED_VERSION);
        wp_enqueue_style('minfin-social-feed');
        wp_add_inline_style('minfin-social-feed', $this->get_inline_css());
    }

    public function register_settings_page() {
        add_options_page(
            'MINFIN Social Feed',
            'MINFIN Social Feed',
            'manage_options',
            'minfin-social-feed',
            [$this, 'render_settings_page']
        );
    }

    public function register_settings() {
        register_setting('minfin_social_feed_group', MINFIN_SOCIAL_FEED_OPTION, [
            'sanitize_callback' => [$this, 'sanitize_settings'],
        ]);
    }

    public function sanitize_settings($input) {
        return [
            'api_url' => isset($input['api_url']) ? untrailingslashit(esc_url_raw($input['api_url'])) : '',
            'cache_seconds' => isset($input['cache_seconds']) ? max(0, intval($input['cache_seconds'])) : 10,
        ];
    }

    private function get_settings() {
        $defaults = ['api_url' => '', 'cache_seconds' => 10];
        return wp_parse_args(get_option(MINFIN_SOCIAL_FEED_OPTION, []), $defaults);
    }

    public function render_settings_page() {
        $settings = $this->get_settings();
        ?>
        <div class="wrap">
            <h1>MINFIN Social Feed</h1>
            <p>Configure la URL de la API del Gestor Centralizado de Redes Sociales.</p>
            <form method="post" action="options.php">
                <?php settings_fields('minfin_social_feed_group'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="minfin_api_url">URL de la API</label></th>
                        <td>
                            <input type="url" id="minfin_api_url" name="<?php echo esc_attr(MINFIN_SOCIAL_FEED_OPTION); ?>[api_url]"
                                value="<?php echo esc_attr($settings['api_url']); ?>" class="regular-text"
                                placeholder="http://localhost:4000" required />
                            <button type="button" id="minfin-test-connection" class="button">Probar Conexión</button>
                            <span id="minfin-test-connection-result" style="margin-left:8px;"></span>
                            <p class="description">Ejemplo: http://localhost:4000 (sin barra final). No requiere autenticación — usa el endpoint público de solo lectura.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="minfin_cache_seconds">Caché (segundos)</label></th>
                        <td>
                            <input type="number" id="minfin_cache_seconds" name="<?php echo esc_attr(MINFIN_SOCIAL_FEED_OPTION); ?>[cache_seconds]"
                                value="<?php echo esc_attr($settings['cache_seconds']); ?>" min="0" class="small-text" />
                            <p class="description">Tiempo que se guarda el feed en caché (WordPress Transients) antes de volver a consultar la API. Un cambio hecho en el Gestor puede tardar hasta este tiempo en verse aquí. Recomendado: 10-30 segundos.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Guardar configuración'); ?>
            </form>

            <h2>Uso del shortcode</h2>
            <p>Inserte en cualquier entrada, página o widget:</p>
            <code>[minfin_social_feed feed="slug-del-feed" layout="grid" limit="6" metrics="true" media="true"]</code>
            <ul>
                <li><strong>feed</strong> (obligatorio): el slug del feed configurado en el Gestor Centralizado.</li>
                <li><strong>layout</strong>: grid | list | carousel | single (por defecto: el configurado en el feed).</li>
                <li><strong>limit</strong>: cantidad máxima de publicaciones a mostrar.</li>
                <li><strong>metrics</strong>: true|false — mostrar estadísticas de interacción.</li>
                <li><strong>media</strong>: true|false — mostrar imágenes/miniaturas.</li>
            </ul>
        </div>
        <script>
        (function() {
            var btn = document.getElementById('minfin-test-connection');
            var result = document.getElementById('minfin-test-connection-result');
            var urlInput = document.getElementById('minfin_api_url');
            if (!btn) return;

            btn.addEventListener('click', function() {
                var apiUrl = urlInput.value.trim();
                result.textContent = 'Probando...';
                result.style.color = '#646970';

                var body = new URLSearchParams();
                body.set('action', 'minfin_test_connection');
                body.set('nonce', '<?php echo esc_js(wp_create_nonce('minfin_test_connection')); ?>');
                body.set('api_url', apiUrl);

                fetch('<?php echo esc_url(admin_url('admin-ajax.php')); ?>', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: body.toString(),
                })
                    .then(function(res) { return res.json(); })
                    .then(function(data) {
                        if (data.success) {
                            result.textContent = '✅ ' + data.data.message;
                            result.style.color = '#008a20';
                        } else {
                            result.textContent = '❌ No se pudo conectar: ' + data.data.message;
                            result.style.color = '#d63638';
                        }
                    })
                    .catch(function() {
                        result.textContent = '❌ No se pudo conectar (error de red del navegador).';
                        result.style.color = '#d63638';
                    });
            });
        })();
        </script>
        <?php
    }

    public function render_shortcode($atts) {
        $atts = shortcode_atts([
            'feed' => '',
            'layout' => '',
            'limit' => '',
            'metrics' => '',
            'media' => '',
        ], $atts, 'minfin_social_feed');

        $slug = sanitize_title($atts['feed']);
        if (empty($slug)) {
            return $this->render_error('Debe especificar el atributo "feed" con el slug del feed institucional.');
        }

        $settings = $this->get_settings();
        if (empty($settings['api_url'])) {
            return $this->render_error('El plugin MINFIN Social Feed no está configurado. Vaya a Ajustes → MINFIN Social Feed.');
        }

        $feed = $this->fetch_feed($slug, $settings);
        if (is_wp_error($feed)) {
            return $this->render_error('No se pudo cargar el feed: ' . esc_html($feed->get_error_message()));
        }
        if (empty($feed)) {
            return $this->render_error('El feed solicitado no existe o fue eliminado.');
        }

        $layout = !empty($atts['layout']) ? sanitize_key($atts['layout']) : $feed['layoutDefault'];
        $limit = is_numeric($atts['limit']) ? intval($atts['limit']) : intval($feed['maxItemsDefault']);
        $show_metrics = $atts['metrics'] !== '' ? filter_var($atts['metrics'], FILTER_VALIDATE_BOOLEAN) : $feed['showMetrics'];
        $show_media = $atts['media'] !== '' ? filter_var($atts['media'], FILTER_VALIDATE_BOOLEAN) : $feed['showMedia'];

        $posts = array_slice($feed['posts'], 0, max(1, $limit));

        return $this->render_feed($feed, $posts, $layout, $show_metrics, $show_media);
    }

    private function fetch_feed($slug, $settings) {
        $cache_key = 'minfin_feed_' . md5($slug . $settings['api_url']);
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            return $cached;
        }

        $response = wp_remote_get(
            $settings['api_url'] . '/public/feeds/' . rawurlencode($slug),
            ['timeout' => 8]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code === 404) {
            return null;
        }
        if ($code !== 200) {
            return new WP_Error('minfin_api_error', 'La API respondió con el código ' . $code);
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($body)) {
            return new WP_Error('minfin_api_error', 'Respuesta inválida de la API.');
        }

        // Aplana posts[].post -> posts[] para simplificar el render.
        $body['posts'] = array_map(function ($link) {
            return $link['post'];
        }, $body['posts']);

        set_transient($cache_key, $body, max(0, intval($settings['cache_seconds'])));

        return $body;
    }

    private function render_error($message) {
        return '<div class="minfin-social-feed-error">' . esc_html($message) . '</div>';
    }

    private function render_feed($feed, $posts, $layout, $show_metrics, $show_media) {
        if (empty($posts)) {
            return '<div class="minfin-social-feed minfin-social-feed--empty">No hay publicaciones registradas en este feed.</div>';
        }

        $layout_class = 'minfin-social-feed--' . sanitize_html_class($layout ?: 'grid');
        $has_x_post = false;
        ob_start();
        ?>
        <div class="minfin-social-feed <?php echo esc_attr($layout_class); ?>">
            <?php foreach ($posts as $post): ?>
                <?php if (($post['network'] ?? '') === 'x'): ?>
                    <?php $has_x_post = true; ?>
                    <?php echo $this->render_card_x($post); ?>
                <?php elseif (($post['network'] ?? '') === 'facebook'): ?>
                    <?php echo $this->render_card_facebook($post); ?>
                <?php else: ?>
                    <?php echo $this->render_card($post, $show_metrics, $show_media); ?>
                <?php endif; ?>
            <?php endforeach; ?>
        </div>
        <?php if ($has_x_post): ?>
            <script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>
        <?php endif; ?>
        <?php
        return ob_get_clean();
    }

    // X ya no sirve datos completos (imagen, avatar) a scrapers/APIs no
    // oficiales de forma confiable, así que en vez de reconstruir una tarjeta
    // propia usamos el embed oficial de X (blockquote + widgets.js) — el
    // mismo mecanismo que ofrece "Insertar publicación" en x.com. Requiere
    // que el post tenga una URL de x.com/twitter.com válida.
    private function render_card_x($post) {
        $url = $post['url'] ?? '';
        ob_start();
        ?>
        <div class="minfin-social-feed__x-embed">
            <blockquote class="twitter-tweet" data-lang="es" data-dnt="true">
                <a href="<?php echo esc_url($url); ?>"></a>
            </blockquote>
        </div>
        <?php
        return ob_get_clean();
    }

    // Facebook restringe la Graph API a publicaciones propias con un Page
    // Access Token, pero el "Post Embed" oficial (plugins/post.php) funciona
    // para cualquier publicación pública sin credenciales — igual mecanismo
    // que "Insertar publicación" en facebook.com.
    private function render_card_facebook($post) {
        $url = $post['url'] ?? '';
        $embed_url = 'https://www.facebook.com/plugins/post.php?href=' . rawurlencode($url) . '&show_text=true&width=500';
        ob_start();
        ?>
        <div class="minfin-social-feed__fb-embed">
            <iframe
                src="<?php echo esc_url($embed_url); ?>"
                title="Publicación de Facebook"
                loading="lazy"
                style="border:none;overflow:hidden;"
                scrolling="no"
                allow="encrypted-media"
            ></iframe>
        </div>
        <?php
        return ob_get_clean();
    }

    private function render_card($post, $show_metrics, $show_media) {
        $media_url = !empty($post['mediaUrl']) ? $post['mediaUrl'] : (!empty($post['mediaThumb']) ? $post['mediaThumb'] : '');
        $stats = is_array($post['stats'] ?? null) ? $post['stats'] : [];

        ob_start();
        ?>
        <div class="minfin-social-feed__card">
            <div class="minfin-social-feed__header">
                <?php if (!empty($post['authorAvatarUrl'])): ?>
                    <img class="minfin-social-feed__avatar minfin-social-feed__avatar--photo" src="<?php echo esc_url($post['authorAvatarUrl']); ?>" alt="<?php echo esc_attr($post['authorName']); ?>" />
                <?php else: ?>
                    <div class="minfin-social-feed__avatar"><?php echo esc_html(mb_substr($post['authorName'], 0, 1)); ?></div>
                <?php endif; ?>
                <div class="minfin-social-feed__author">
                    <div class="minfin-social-feed__author-name"><?php echo esc_html($post['authorName']); ?></div>
                    <div class="minfin-social-feed__author-handle"><?php echo esc_html($post['authorHandle']); ?> · <?php echo esc_html($post['publishedAt']); ?></div>
                </div>
            </div>
            <div class="minfin-social-feed__content"><?php echo nl2br(esc_html($post['content'])); ?></div>
            <?php if ($show_media && ($post['network'] ?? '') === 'youtube'): ?>
                <div class="minfin-social-feed__media minfin-social-feed__media--video">
                    <iframe
                        src="<?php echo esc_url('https://www.youtube.com/embed/' . rawurlencode($post['postId'])); ?>"
                        title="<?php echo esc_attr($post['content']); ?>"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen
                    ></iframe>
                </div>
            <?php elseif ($show_media && $media_url): ?>
                <div class="minfin-social-feed__media">
                    <img src="<?php echo esc_url($media_url); ?>" alt="" loading="lazy" />
                </div>
            <?php endif; ?>
            <div class="minfin-social-feed__footer">
                <?php if ($show_metrics && !empty($stats)): ?>
                    <div class="minfin-social-feed__stats">
                        <?php if (isset($stats['likes'])): ?><span>❤ <?php echo esc_html($stats['likes']); ?></span><?php endif; ?>
                        <?php if (isset($stats['reposts'])): ?><span>🔁 <?php echo esc_html($stats['reposts']); ?></span><?php endif; ?>
                        <?php if (isset($stats['comments'])): ?><span>💬 <?php echo esc_html($stats['comments']); ?></span><?php endif; ?>
                        <?php if (isset($stats['views'])): ?><span>👁 <?php echo esc_html(number_format_i18n($stats['views'])); ?></span><?php endif; ?>
                    </div>
                <?php else: ?>
                    <span class="minfin-social-feed__brand">MINFIN Oficial</span>
                <?php endif; ?>
                <a href="<?php echo esc_url($post['url']); ?>" target="_blank" rel="noopener noreferrer">Ver publicación →</a>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    private function get_inline_css() {
        return <<<CSS
.minfin-social-feed { display: grid; gap: 16px; }
.minfin-social-feed--grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.minfin-social-feed--list { grid-template-columns: 1fr; max-width: 640px; }
.minfin-social-feed--single { grid-template-columns: 1fr; max-width: 520px; }
.minfin-social-feed--carousel { grid-auto-flow: column; grid-auto-columns: minmax(280px, 1fr); overflow-x: auto; }
.minfin-social-feed__card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(0,0,0,0.04); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.minfin-social-feed__header { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid #f1f5f9; }
.minfin-social-feed__avatar { width: 36px; height: 36px; border-radius: 50%; background: #0c2340; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.minfin-social-feed__avatar--photo { object-fit: cover; background: #e2e8f0; }
.minfin-social-feed__author-name { font-weight: 700; font-size: 13px; color: #0f172a; }
.minfin-social-feed__author-handle { font-size: 11px; color: #64748b; }
.minfin-social-feed__content { padding: 14px; font-size: 13px; color: #1e293b; line-height: 1.5; white-space: pre-line; flex: 1; }
.minfin-social-feed__media { background: #020617; height: 240px; overflow: hidden; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }
.minfin-social-feed__media img { width: 100%; height: 100%; object-fit: contain; }
.minfin-social-feed__media--video { height: auto; aspect-ratio: 16 / 9; }
.minfin-social-feed__media--video iframe { width: 100%; height: 100%; border: 0; display: block; }
.minfin-social-feed__footer { padding: 10px 14px; background: #f8fafc; display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
.minfin-social-feed__footer a { color: #1d4ed8; text-decoration: none; font-weight: 600; }
.minfin-social-feed__footer a:hover { text-decoration: underline; }
.minfin-social-feed__stats { display: flex; gap: 10px; color: #475569; font-family: monospace; }
.minfin-social-feed__brand { color: #94a3b8; font-family: monospace; }
.minfin-social-feed__x-embed { display: flex; justify-content: center; }
.minfin-social-feed__x-embed .twitter-tweet { margin: 0 auto !important; }
.minfin-social-feed__fb-embed { display: flex; justify-content: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
.minfin-social-feed__fb-embed iframe { width: 100%; max-width: 500px; height: 680px; }
.minfin-social-feed-error { padding: 12px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; font-size: 13px; }
.minfin-social-feed--empty { padding: 24px; text-align: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; }
CSS;
    }
}

new Minfin_Social_Feed();
