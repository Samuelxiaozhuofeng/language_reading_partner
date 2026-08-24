package com.samdagreat.multireader;

import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

@CapacitorPlugin(name = "EdgeTts")
public class EdgeTtsPlugin extends Plugin {
    private static final String TAG = "EdgeTtsPlugin";
    private static final String TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static final String SEC_MS_GEC_VERSION = "1-143.0.3650.75";
    private static final String WS_ORIGIN = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.3650.75";

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .build();

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    private String computeSecMsGec() {
        try {
            long nowSeconds = System.currentTimeMillis() / 1000L;
            long unix = nowSeconds + 11644473600L;
            unix -= (unix % 300L);
            long ticks = unix * 10000000L;
            String toHash = Long.toString(ticks) + TRUSTED_CLIENT_TOKEN;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(toHash.getBytes(StandardCharsets.US_ASCII));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xFF & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase(Locale.ROOT);
        } catch (Exception e) {
            Log.e(TAG, "Failed to compute Sec-MS-GEC", e);
            return "";
        }
    }

    private String formatUtcTimestamp() {
        SimpleDateFormat sdf = new SimpleDateFormat("EEE MMM dd yyyy HH:mm:ss 'GMT+0000 (Coordinated Universal Time)'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }

    private String escapeXml(String input) {
        if (input == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            if (c < 0x20 && c != '\t' && c != '\r' && c != '\n') {
                continue;
            }
            if (c == 0x7F) {
                continue;
            }
            switch (c) {
                case '&':
                    sb.append("&amp;");
                    break;
                case '<':
                    sb.append("&lt;");
                    break;
                case '>':
                    sb.append("&gt;");
                    break;
                case '"':
                    sb.append("&quot;");
                    break;
                case '\'':
                    sb.append("&apos;");
                    break;
                default:
                    sb.append(c);
                    break;
            }
        }
        return sb.toString();
    }

    @PluginMethod
    public void synthesize(PluginCall call) {
        String text = call.getString("text");
        String voice = call.getString("voice");

        if (text == null || text.trim().isEmpty()) {
            call.reject("INVALID_ARGUMENT", "text 不能为空");
            return;
        }
        if (voice == null || voice.trim().isEmpty()) {
            call.reject("INVALID_ARGUMENT", "voice 不能为空");
            return;
        }

        String cleanText = text.trim();
        String cleanVoice = voice.trim();

        String connId = UUID.randomUUID().toString().replace("-", "");
        String reqId = UUID.randomUUID().toString().replace("-", "");
        String muid = UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        String secMsGec = computeSecMsGec();

        String url = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
            + "?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN
            + "&ConnectionId=" + connId
            + "&Sec-MS-GEC=" + secMsGec
            + "&Sec-MS-GEC-Version=" + SEC_MS_GEC_VERSION;

        Request request = new Request.Builder()
            .url(url)
            .header("Origin", WS_ORIGIN)
            .header("User-Agent", USER_AGENT)
            .header("Pragma", "no-cache")
            .header("Cache-Control", "no-cache")
            .header("Cookie", "muid=" + muid + ";")
            .build();

        ByteArrayOutputStream audioBuffer = new ByteArrayOutputStream();
        AtomicBoolean completed = new AtomicBoolean(false);
        WebSocket[] wsHolder = new WebSocket[1];

        ScheduledFuture<?> timeoutFuture = scheduler.schedule(() -> {
            if (completed.compareAndSet(false, true)) {
                if (wsHolder[0] != null) {
                    try {
                        wsHolder[0].cancel();
                    } catch (Exception ignored) {}
                }
                call.reject("TIMEOUT", "语音合成超时 (12秒)");
            }
        }, 12, TimeUnit.SECONDS);

        WebSocketListener listener = new WebSocketListener() {
            @Override
            public void onOpen(@NonNull WebSocket webSocket, @NonNull Response response) {
                String timestamp = formatUtcTimestamp();
                String configMsg = "X-Timestamp:" + timestamp + "\r\n"
                    + "Content-Type:application/json; charset=utf-8\r\n"
                    + "Path:speech.config\r\n\r\n"
                    + "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}\r\n";

                String escapedVoice = escapeXml(cleanVoice);
                String escapedContent = escapeXml(cleanText);
                String ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
                    + "<voice name='" + escapedVoice + "'>"
                    + "<prosody pitch='+0Hz' rate='+0%' volume='+0%'>"
                    + escapedContent
                    + "</prosody></voice></speak>";

                String ssmlMsg = "X-RequestId:" + reqId + "\r\n"
                    + "Content-Type:application/ssml+xml\r\n"
                    + "X-Timestamp:" + timestamp + "Z\r\n"
                    + "Path:ssml\r\n\r\n"
                    + ssml;

                webSocket.send(configMsg);
                webSocket.send(ssmlMsg);
            }

            @Override
            public void onMessage(@NonNull WebSocket webSocket, @NonNull String text) {
                if (text.contains("Path:turn.end")) {
                    if (completed.compareAndSet(false, true)) {
                        timeoutFuture.cancel(false);
                        try {
                            webSocket.close(1000, "Normal Closure");
                        } catch (Exception ignored) {}

                        byte[] audioBytes;
                        synchronized (audioBuffer) {
                            audioBytes = audioBuffer.toByteArray();
                        }

                        if (audioBytes.length == 0) {
                            call.reject("NO_AUDIO", "未接收到有效音频数据");
                        } else {
                            String base64 = Base64.encodeToString(audioBytes, Base64.NO_WRAP);
                            JSObject ret = new JSObject();
                            ret.put("audioBase64", base64);
                            call.resolve(ret);
                        }
                    }
                }
            }

            @Override
            public void onMessage(@NonNull WebSocket webSocket, @NonNull ByteString bytes) {
                byte[] raw = bytes.toByteArray();
                if (raw.length >= 2) {
                    int headerLength = ((raw[0] & 0xFF) << 8) | (raw[1] & 0xFF);
                    if (raw.length >= 2 + headerLength) {
                        String headers = new String(raw, 2, headerLength, StandardCharsets.UTF_8);
                        if (headers.contains("Content-Type:audio/mpeg")) {
                            int offset = 2 + headerLength;
                            int length = raw.length - offset;
                            if (length > 0) {
                                synchronized (audioBuffer) {
                                    audioBuffer.write(raw, offset, length);
                                }
                            }
                        }
                    }
                }
            }

            @Override
            public void onFailure(@NonNull WebSocket webSocket, @NonNull Throwable t, @Nullable Response response) {
                if (completed.compareAndSet(false, true)) {
                    timeoutFuture.cancel(false);
                    call.reject("SYNTHESIS_FAILED", t.getMessage() != null ? t.getMessage() : "WebSocket 连接失败", new Exception(t));
                }
            }

            @Override
            public void onClosed(@NonNull WebSocket webSocket, int code, @NonNull String reason) {
                if (completed.compareAndSet(false, true)) {
                    timeoutFuture.cancel(false);
                    byte[] audioBytes;
                    synchronized (audioBuffer) {
                        audioBytes = audioBuffer.toByteArray();
                    }
                    if (audioBytes.length > 0) {
                        String base64 = Base64.encodeToString(audioBytes, Base64.NO_WRAP);
                        JSObject ret = new JSObject();
                        ret.put("audioBase64", base64);
                        call.resolve(ret);
                    } else {
                        call.reject("CLOSED_EARLY", "连接过早关闭: " + reason);
                    }
                }
            }
        };

        wsHolder[0] = httpClient.newWebSocket(request, listener);
    }
}
