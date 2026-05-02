package com.samdagreat.multireader;

import android.os.Bundle;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    SystemUiController.hideStatusBar(this);
  }

  @Override
  public void onResume() {
    super.onResume();
    SystemUiController.hideStatusBar(this);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      SystemUiController.hideStatusBar(this);
    }
  }
}
