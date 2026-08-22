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

    private $floating_rendered = false;
    private static $floating_instance = 0;

    public function __construct() {
        add_action('admin_menu', [$this, 'register_settings_page']);
        add_action('admin_init', [$this, 'register_settings']);
        add_shortcode('minfin_social_feed', [$this, 'render_shortcode']);
        add_shortcode('minfin_social_floating', [$this, 'render_floating_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_styles']);
        add_action('wp_ajax_minfin_test_connection', [$this, 'ajax_test_connection']);
        add_action('wp_footer', [$this, 'maybe_render_floating_sitewide']);
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
            'floating_enabled' => !empty($input['floating_enabled']) ? '1' : '',
            'floating_feed' => isset($input['floating_feed']) ? $this->sanitize_slug_list($input['floating_feed']) : '',
            'floating_position' => (isset($input['floating_position']) && $input['floating_position'] === 'bottom-left')
                ? 'bottom-left' : 'bottom-right',
        ];
    }

    private function sanitize_slug_list($raw) {
        $parts = array_filter(array_map('sanitize_title', explode(',', (string) $raw)));
        return implode(',', $parts);
    }

    private function get_settings() {
        $defaults = [
            'api_url' => '',
            'cache_seconds' => 10,
            'floating_enabled' => '',
            'floating_feed' => '',
            'floating_position' => 'bottom-right',
        ];
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
                    <tr>
                        <th scope="row"><label for="minfin_floating_feed">Botones flotantes</label></th>
                        <td>
                            <label>
                                <input type="checkbox" id="minfin_floating_enabled" name="<?php echo esc_attr(MINFIN_SOCIAL_FEED_OPTION); ?>[floating_enabled]"
                                    value="1" <?php checked(!empty($settings['floating_enabled'])); ?> />
                                Mostrar botones flotantes en todo el sitio
                            </label>
                            <p class="description" style="margin-top:10px;">
                                <label for="minfin_floating_feed">Slug(s) del feed a usar:</label><br />
                                <input type="text" id="minfin_floating_feed" name="<?php echo esc_attr(MINFIN_SOCIAL_FEED_OPTION); ?>[floating_feed]"
                                    value="<?php echo esc_attr($settings['floating_feed']); ?>" class="regular-text" placeholder="actualiza-tus-datos, facebook" />
                                <br /><span class="description">Puede indicar varios feeds separados por coma (ej. uno por red social) para combinarlos en los botones flotantes.</span>
                            </p>
                            <p class="description">
                                <label for="minfin_floating_position">Posición:</label><br />
                                <select id="minfin_floating_position" name="<?php echo esc_attr(MINFIN_SOCIAL_FEED_OPTION); ?>[floating_position]">
                                    <option value="bottom-right" <?php selected($settings['floating_position'], 'bottom-right'); ?>>Inferior derecha</option>
                                    <option value="bottom-left" <?php selected($settings['floating_position'], 'bottom-left'); ?>>Inferior izquierda</option>
                                </select>
                            </p>
                            <p class="description">Aparece un botón circular por cada red social que tenga publicaciones en el feed seleccionado. Al hacer clic se abre una ventana con las publicaciones de esa red.</p>
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

            <h2>Botones flotantes</h2>
            <p>Además de activarlos arriba para todo el sitio, puede insertarlos manualmente en una página o entrada específica:</p>
            <code>[minfin_social_floating feed="slug-del-feed" position="bottom-right"]</code>
            <p class="description">Si no indica "feed", usa el configurado arriba. Acepta varios slugs separados por coma. "position" acepta bottom-right o bottom-left.</p>
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

    public function render_floating_shortcode($atts) {
        $atts = shortcode_atts([
            'feed' => '',
            'position' => '',
        ], $atts, 'minfin_social_floating');

        $settings = $this->get_settings();
        $slug = !empty($atts['feed']) ? $this->sanitize_slug_list($atts['feed']) : $settings['floating_feed'];
        $position = ($atts['position'] === 'bottom-left' || $atts['position'] === 'bottom-right')
            ? $atts['position'] : $settings['floating_position'];

        if (empty($slug) || empty($settings['api_url'])) {
            return '';
        }

        return $this->render_floating($slug, $position, $settings);
    }

    public function maybe_render_floating_sitewide() {
        if ($this->floating_rendered) {
            return;
        }
        $settings = $this->get_settings();
        if (empty($settings['floating_enabled']) || empty($settings['floating_feed']) || empty($settings['api_url'])) {
            return;
        }
        echo $this->render_floating($settings['floating_feed'], $settings['floating_position'], $settings); // phpcs:ignore WordPress.Security.EscapeOutput
    }

    private function get_network_meta($network) {
        $map = [
            'x' => ['label' => 'X (Twitter)', 'color' => '#000000',
                'svg' => '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>'],
            'facebook' => ['label' => 'Facebook', 'color' => '#1877F2',
                'svg' => '<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>'],
            'instagram' => ['label' => 'Instagram', 'color' => '#E4405F',
                'svg' => '<rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="none" stroke="currentColor" stroke-width="2"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'],
            'youtube' => ['label' => 'YouTube', 'color' => '#FF0000',
                'svg' => '<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>'],
            'linkedin' => ['label' => 'LinkedIn', 'color' => '#0A66C2',
                'svg' => '<path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>'],
            'tiktok' => ['label' => 'TikTok', 'color' => '#000000',
                'svg' => '<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.02 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>'],
        ];
        return $map[$network] ?? [
            'label' => ucfirst($network),
            'color' => '#475569',
            'svg' => '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2"/>',
        ];
    }

    private function render_floating($slugs, $position, $settings) {
        // Admite uno o varios feeds separados por coma, para poder combinar
        // feeds organizados por red (uno para X, otro para Facebook, etc.)
        // sin obligar a moverlos todos a un único feed "Multi-Red".
        $slug_list = array_filter(array_map('sanitize_title', explode(',', (string) $slugs)));
        if (empty($slug_list)) {
            return '';
        }

        // Agrupa las publicaciones por red, conservando el orden de aparición.
        // Si una red aparece en más de un feed, se combinan sus publicaciones.
        $groups = [];
        foreach ($slug_list as $one_slug) {
            $feed = $this->fetch_feed($one_slug, $settings);
            if (is_wp_error($feed) || empty($feed) || empty($feed['posts'])) {
                continue;
            }
            foreach ($feed['posts'] as $post) {
                $network = $post['network'] ?? 'mixed';
                if (!isset($groups[$network])) {
                    $groups[$network] = [];
                }
                $groups[$network][] = $post;
            }
        }
        if (empty($groups)) {
            return '';
        }

        $this->floating_rendered = true;
        $instance = ++self::$floating_instance;
        $has_x_post = isset($groups['x']);
        $has_ig_post = isset($groups['instagram']);
        $position_class = $position === 'bottom-left' ? 'minfin-floating--left' : 'minfin-floating--right';

        ob_start();
        ?>
        <div class="minfin-floating <?php echo esc_attr($position_class); ?>" id="minfin-floating-<?php echo esc_attr($instance); ?>">
            <div class="minfin-floating__buttons">
                <?php foreach ($groups as $network => $posts): $meta = $this->get_network_meta($network); ?>
                    <button type="button" class="minfin-floating__btn" style="--minfin-brand: <?php echo esc_attr($meta['color']); ?>"
                        data-minfin-target="<?php echo esc_attr($network); ?>" aria-label="Ver publicaciones de <?php echo esc_attr($meta['label']); ?>">
                        <svg viewBox="0 0 24 24" width="22" height="22"><?php echo $meta['svg']; // phpcs:ignore ?></svg>
                    </button>
                <?php endforeach; ?>
            </div>

            <div class="minfin-floating__panel" role="dialog" aria-modal="false" hidden>
                <div class="minfin-floating__panel-header">
                    <span class="minfin-floating__panel-icon"></span>
                    <span class="minfin-floating__panel-title"></span>
                    <button type="button" class="minfin-floating__close" data-minfin-close aria-label="Cerrar">&times;</button>
                </div>
                <div class="minfin-floating__panel-body">
                    <?php foreach ($groups as $network => $posts): $meta = $this->get_network_meta($network); ?>
                        <div class="minfin-floating__group" data-minfin-group="<?php echo esc_attr($network); ?>"
                            data-minfin-label="<?php echo esc_attr($meta['label']); ?>" hidden>
                            <?php foreach ($posts as $post): ?>
                                <?php if ($network === 'x'): ?>
                                    <?php echo $this->render_card_x($post); ?>
                                <?php elseif ($network === 'facebook'): ?>
                                    <?php echo $this->render_card_facebook($post); ?>
                                <?php elseif ($network === 'linkedin'): ?>
                                    <?php echo $this->render_card_linkedin($post); ?>
                                <?php elseif ($network === 'instagram'): ?>
                                    <?php echo $this->render_card_instagram($post); ?>
                                <?php else: ?>
                                    <?php echo $this->render_card($post, true, true); ?>
                                <?php endif; ?>
                            <?php endforeach; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        <?php if ($has_x_post): ?>
            <script>
            window.minfinLoadTwitterWidgets = function () {
                if (window.twttr && window.twttr.widgets) { window.twttr.widgets.load(); return; }
                if (document.getElementById('minfin-twitter-wjs')) { return; }
                var s = document.createElement('script');
                s.id = 'minfin-twitter-wjs';
                s.async = true;
                s.src = 'https://platform.x.com/widgets.js';
                document.body.appendChild(s);
            };
            </script>
        <?php endif; ?>
        <?php if ($has_ig_post): ?>
            <script>
            window.minfinLoadInstagramEmbeds = function () {
                if (window.instgrm && window.instgrm.Embeds) { window.instgrm.Embeds.process(); return; }
                if (document.getElementById('minfin-instagram-embedjs')) { return; }
                var s = document.createElement('script');
                s.id = 'minfin-instagram-embedjs';
                s.async = true;
                s.src = 'https://www.instagram.com/embed.js';
                document.body.appendChild(s);
            };
            </script>
        <?php endif; ?>
        <script>
        (function () {
            var root = document.getElementById('minfin-floating-<?php echo esc_js($instance); ?>');
            if (!root) return;
            var panel = root.querySelector('.minfin-floating__panel');
            var title = root.querySelector('.minfin-floating__panel-title');
            var icon = root.querySelector('.minfin-floating__panel-icon');
            var groups = root.querySelectorAll('[data-minfin-group]');
            var openNetwork = null;

            function openGroup(network) {
                groups.forEach(function (g) {
                    g.hidden = g.getAttribute('data-minfin-group') !== network;
                });
                var active = root.querySelector('[data-minfin-group="' + network + '"]');
                title.textContent = active ? active.getAttribute('data-minfin-label') : '';
                var btn = root.querySelector('.minfin-floating__btn[data-minfin-target="' + network + '"]');
                icon.innerHTML = btn ? btn.querySelector('svg').outerHTML : '';
                icon.style.color = btn ? getComputedStyle(btn).getPropertyValue('--minfin-brand') : '';
                panel.hidden = false;
                requestAnimationFrame(function () { panel.classList.add('is-open'); });
                openNetwork = network;
                if (network === 'x' && window.minfinLoadTwitterWidgets) {
                    window.minfinLoadTwitterWidgets();
                }
                if (network === 'instagram' && window.minfinLoadInstagramEmbeds) {
                    window.minfinLoadInstagramEmbeds();
                }
            }

            function closePanel() {
                panel.classList.remove('is-open');
                openNetwork = null;
                window.setTimeout(function () {
                    if (!panel.classList.contains('is-open')) panel.hidden = true;
                }, 220);
            }

            root.querySelectorAll('.minfin-floating__btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var network = btn.getAttribute('data-minfin-target');
                    if (openNetwork === network) {
                        closePanel();
                    } else {
                        openGroup(network);
                    }
                });
            });
            root.querySelectorAll('[data-minfin-close]').forEach(function (el) {
                el.addEventListener('click', closePanel);
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && openNetwork) closePanel();
            });
        })();
        </script>
        <?php
        return ob_get_clean();
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
        $has_ig_post = false;
        ob_start();
        ?>
        <div class="minfin-social-feed <?php echo esc_attr($layout_class); ?>">
            <?php foreach ($posts as $post): ?>
                <?php if (($post['network'] ?? '') === 'x'): ?>
                    <?php $has_x_post = true; ?>
                    <?php echo $this->render_card_x($post); ?>
                <?php elseif (($post['network'] ?? '') === 'facebook'): ?>
                    <?php echo $this->render_card_facebook($post); ?>
                <?php elseif (($post['network'] ?? '') === 'linkedin'): ?>
                    <?php echo $this->render_card_linkedin($post); ?>
                <?php elseif (($post['network'] ?? '') === 'instagram'): ?>
                    <?php $has_ig_post = true; ?>
                    <?php echo $this->render_card_instagram($post); ?>
                <?php else: ?>
                    <?php echo $this->render_card($post, $show_metrics, $show_media); ?>
                <?php endif; ?>
            <?php endforeach; ?>
        </div>
        <?php if ($has_x_post): ?>
            <script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>
        <?php endif; ?>
        <?php if ($has_ig_post): ?>
            <script async src="https://www.instagram.com/embed.js"></script>
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

    // Instagram no ofrece oEmbed público sin una app aprobada por Meta, pero
    // su embed oficial (blockquote + embed.js) funciona sin credenciales para
    // cualquier publicación pública — mismo mecanismo que "Insertar" en
    // instagram.com.
    private function render_card_instagram($post) {
        $url = $post['url'] ?? '';
        ob_start();
        ?>
        <div class="minfin-social-feed__ig-embed">
            <blockquote class="instagram-media" data-instgrm-permalink="<?php echo esc_url($url); ?>" data-instgrm-version="14" style="margin:0;">
                <a href="<?php echo esc_url($url); ?>"></a>
            </blockquote>
        </div>
        <?php
        return ob_get_clean();
    }

    // LinkedIn no ofrece Graph API pública para publicaciones institucionales,
    // pero su embed oficial ("Insertar" / Embed this post) funciona sin
    // credenciales para cualquier publicación pública. El backend ya entrega
    // post['url'] normalizado como la URL de embed
    // (https://www.linkedin.com/embed/feed/update/urn:li:...).
    private function render_card_linkedin($post) {
        $url = $post['url'] ?? '';
        ob_start();
        ?>
        <div class="minfin-social-feed__li-embed">
            <iframe
                src="<?php echo esc_url($url); ?>"
                title="Publicación de LinkedIn"
                loading="lazy"
                style="border:none;"
                allowfullscreen
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
.minfin-social-feed__li-embed { display: flex; justify-content: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
.minfin-social-feed__li-embed iframe { width: 100%; max-width: 504px; height: 670px; }
.minfin-social-feed__ig-embed { display: flex; justify-content: center; }
.minfin-social-feed__ig-embed .instagram-media { margin: 0 auto !important; }
.minfin-social-feed-error { padding: 12px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; font-size: 13px; }
.minfin-social-feed--empty { padding: 24px; text-align: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; }

.minfin-floating { position: fixed; bottom: 24px; z-index: 99998; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: flex-end; gap: 14px; }
.minfin-floating--right { right: 24px; flex-direction: row-reverse; }
.minfin-floating--left { left: 24px; flex-direction: row; }
.minfin-floating__buttons { display: flex; flex-direction: column; gap: 12px; align-items: center; }
.minfin-floating__btn { width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; background: var(--minfin-brand, #0c2a5a); color: #fff; box-shadow: 0 6px 16px rgba(15,23,42,0.28); transition: transform .15s ease, box-shadow .15s ease; flex-shrink: 0; }
.minfin-floating__btn:hover { transform: scale(1.08); box-shadow: 0 8px 22px rgba(15,23,42,0.36); }
.minfin-floating__btn svg { fill: currentColor; width: 22px; height: 22px; }
.minfin-floating__panel { width: min(92vw, 380px); max-height: min(72vh, 620px); background: #f8fafc; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(8,15,30,0.28); opacity: 0; transform: translateY(16px) scale(.97); transition: opacity .2s ease, transform .2s ease; transform-origin: bottom; }
.minfin-floating__panel.is-open { opacity: 1; transform: translateY(0) scale(1); }
.minfin-floating__panel-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: #0c2a5a; color: #fff; flex-shrink: 0; }
.minfin-floating__panel-icon { display: flex; width: 20px; height: 20px; }
.minfin-floating__panel-icon svg { width: 100%; height: 100%; fill: currentColor; }
.minfin-floating__panel-title { font-weight: 700; font-size: 14px; flex: 1; }
.minfin-floating__close { background: rgba(255,255,255,0.12); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; font-size: 17px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.minfin-floating__close:hover { background: rgba(255,255,255,0.22); }
.minfin-floating__panel-body { padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.minfin-floating__group { display: flex; flex-direction: column; gap: 14px; }
.minfin-floating__group[hidden] { display: none; }
@media (max-width: 480px) {
  .minfin-floating { left: 12px !important; right: 12px !important; bottom: 12px; flex-direction: column-reverse !important; align-items: flex-end; }
  .minfin-floating--left { align-items: flex-start; }
  .minfin-floating__panel { width: 100%; max-height: 62vh; }
}
CSS;
    }
}

new Minfin_Social_Feed();
