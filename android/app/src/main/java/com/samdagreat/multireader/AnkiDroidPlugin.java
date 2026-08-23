package com.samdagreat.multireader;

import android.content.Intent;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.ichi2.anki.api.AddContentApi;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(
    name = "AnkiDroid",
    permissions = {
        @Permission(
            strings = { "com.ichi2.anki.permission.READ_WRITE_DATABASE" },
            alias = "ankidroid"
        )
    }
)
public class AnkiDroidPlugin extends Plugin {
    private static final String PERM_NAME = "com.ichi2.anki.permission.READ_WRITE_DATABASE";
    private AddContentApi api;

    private AddContentApi getApi() {
        if (api == null) {
            api = new AddContentApi(getContext());
        }
        return api;
    }

    private boolean isPermissionGranted() {
        return ContextCompat.checkSelfPermission(getContext(), PERM_NAME) == PackageManager.PERMISSION_GRANTED;
    }

    private Long findModelIdByName(String modelName) {
        try {
            Map<Long, String> modelMap = getApi().getModelList();
            if (modelMap != null) {
                for (Map.Entry<Long, String> entry : modelMap.entrySet()) {
                    if (modelName.equalsIgnoreCase(entry.getValue())) {
                        return entry.getKey();
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Long findDeckIdByName(String deckName) {
        try {
            Map<Long, String> deckMap = getApi().getDeckList();
            if (deckMap != null) {
                for (Map.Entry<Long, String> entry : deckMap.entrySet()) {
                    if (deckName.equalsIgnoreCase(entry.getValue())) {
                        return entry.getKey();
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        String pkg = AddContentApi.getAnkiDroidPackageName(getContext());
        JSObject ret = new JSObject();
        ret.put("available", pkg != null);
        ret.put("packageName", pkg != null ? pkg : "");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (isPermissionGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("ankidroid", call, "ankidroidPermissionCallback");
    }

    @PermissionCallback
    private void ankidroidPermissionCallback(PluginCall call) {
        boolean granted = isPermissionGranted() || getPermissionState("ankidroid") == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDecks(PluginCall call) {
        if (!isPermissionGranted()) {
            call.reject("PERMISSION_DENIED", "未获得 AnkiDroid 数据库读写权限");
            return;
        }
        try {
            Map<Long, String> deckMap = getApi().getDeckList();
            JSArray names = new JSArray();
            if (deckMap != null) {
                for (String deckName : deckMap.values()) {
                    names.put(deckName);
                }
            }
            JSObject ret = new JSObject();
            ret.put("names", names);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("GET_DECKS_FAILED", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getModels(PluginCall call) {
        if (!isPermissionGranted()) {
            call.reject("PERMISSION_DENIED", "未获得 AnkiDroid 数据库读写权限");
            return;
        }
        try {
            Map<Long, String> modelMap = getApi().getModelList();
            JSArray names = new JSArray();
            if (modelMap != null) {
                for (String modelName : modelMap.values()) {
                    names.put(modelName);
                }
            }
            JSObject ret = new JSObject();
            ret.put("names", names);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("GET_MODELS_FAILED", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getModelFields(PluginCall call) {
        if (!isPermissionGranted()) {
            call.reject("PERMISSION_DENIED", "未获得 AnkiDroid 数据库读写权限");
            return;
        }
        String modelName = call.getString("modelName");
        if (modelName == null || modelName.isEmpty()) {
            call.reject("INVALID_ARGUMENT", "modelName 不能为空");
            return;
        }
        try {
            Long modelId = findModelIdByName(modelName);
            if (modelId == null) {
                call.reject("MODEL_NOT_FOUND", "未找到模板: " + modelName);
                return;
            }
            String[] fieldList = getApi().getFieldList(modelId);
            JSArray fields = new JSArray();
            if (fieldList != null) {
                for (String field : fieldList) {
                    fields.put(field);
                }
            }
            JSObject ret = new JSObject();
            ret.put("fields", fields);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("GET_MODEL_FIELDS_FAILED", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void ensureSraNoteType(PluginCall call) {
        if (!isPermissionGranted()) {
            call.reject("PERMISSION_DENIED", "未获得 AnkiDroid 数据库读写权限");
            return;
        }
        String modelName = call.getString("modelName");
        if (modelName == null || modelName.isEmpty()) {
            call.reject("INVALID_ARGUMENT", "modelName 不能为空");
            return;
        }

        try {
            Long existingId = findModelIdByName(modelName);
            if (existingId != null) {
                JSObject ret = new JSObject();
                ret.put("modelName", modelName);
                ret.put("created", false);
                call.resolve(ret);
                return;
            }

            JSArray fieldsArray = call.getArray("fields");
            if (fieldsArray == null || fieldsArray.length() == 0) {
                call.reject("INVALID_ARGUMENT", "fields 不能为空");
                return;
            }

            String[] fields = new String[fieldsArray.length()];
            for (int i = 0; i < fieldsArray.length(); i++) {
                fields[i] = fieldsArray.getString(i);
            }

            String front = call.getString("front", "");
            String back = call.getString("back", "");
            String css = call.getString("css", "");

            String[] cards = new String[] { "Card 1" };
            String[] qfmt = new String[] { front };
            String[] afmt = new String[] { back };

            Long newModelId = getApi().addNewCustomModel(
                modelName,
                fields,
                cards,
                qfmt,
                afmt,
                css,
                null,
                null
            );

            if (newModelId == null) {
                call.reject("CREATE_MODEL_FAILED", "创建 Anki 模板失败");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("modelName", modelName);
            ret.put("created", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("ENSURE_MODEL_FAILED", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void addNote(PluginCall call) {
        if (!isPermissionGranted()) {
            call.reject("PERMISSION_DENIED", "未获得 AnkiDroid 数据库读写权限");
            return;
        }

        String deckName = call.getString("deckName");
        String modelName = call.getString("modelName");
        JSObject fieldsObj = call.getObject("fields");

        if (deckName == null || deckName.isEmpty()) {
            deckName = "多语言阅读助手";
        }
        if (modelName == null || modelName.isEmpty()) {
            call.reject("INVALID_ARGUMENT", "modelName 不能为空");
            return;
        }
        if (fieldsObj == null) {
            call.reject("INVALID_ARGUMENT", "fields 不能为空");
            return;
        }

        try {
            Long deckId = findDeckIdByName(deckName);
            if (deckId == null) {
                deckId = getApi().addNewDeck(deckName);
                if (deckId == null) {
                    call.reject("DECK_CREATION_FAILED", "无法创建牌组: " + deckName);
                    return;
                }
            }

            Long modelId = findModelIdByName(modelName);
            if (modelId == null) {
                call.reject("MODEL_NOT_FOUND", "未找到 Anki 模板: " + modelName);
                return;
            }

            String[] fieldNames = getApi().getFieldList(modelId);
            if (fieldNames == null || fieldNames.length == 0) {
                call.reject("FIELDS_EMPTY", "模板字段列表为空: " + modelName);
                return;
            }

            String[] fieldValues = new String[fieldNames.length];
            for (int i = 0; i < fieldNames.length; i++) {
                String fieldName = fieldNames[i];
                fieldValues[i] = fieldsObj.optString(fieldName, "");
            }

            Set<String> tagSet = new HashSet<>();
            JSArray tagsArray = call.getArray("tags");
            if (tagsArray != null) {
                for (int i = 0; i < tagsArray.length(); i++) {
                    String tag = tagsArray.getString(i);
                    if (tag != null && !tag.isEmpty()) {
                        tagSet.add(tag);
                    }
                }
            }

            Long noteId = getApi().addNote(modelId, deckId, fieldValues, tagSet);
            if (noteId == null) {
                call.reject("ADD_NOTE_FAILED", "添加笔记到 AnkiDroid 失败");
                return;
            }

            JSObject ret = new JSObject();
            ret.put("noteId", noteId);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("ADD_NOTE_FAILED", e.getMessage(), e);
        }
    }

    @PluginMethod
    public void shareNote(PluginCall call) {
        String text = call.getString("text", "");
        String subject = call.getString("subject", "");
        try {
            Intent sendIntent = new Intent();
            sendIntent.setAction(Intent.ACTION_SEND);
            sendIntent.putExtra(Intent.EXTRA_TEXT, text);
            if (subject != null && !subject.isEmpty()) {
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, subject);
            }
            sendIntent.setType("text/plain");
            Intent shareIntent = Intent.createChooser(sendIntent, "分享到 AnkiDroid");
            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(shareIntent);
            JSObject ret = new JSObject();
            ret.put("shared", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("SHARE_FAILED", e.getMessage(), e);
        }
    }
}
