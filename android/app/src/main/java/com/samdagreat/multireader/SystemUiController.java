package com.samdagreat.multireader;

import android.app.Activity;
import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public final class SystemUiController {
  public static void hideStatusBar(Activity activity) {
    View decorView = activity.getWindow().getDecorView();
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(activity.getWindow(), decorView);
    if (controller == null) return;
    controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.statusBars());
  }
}
