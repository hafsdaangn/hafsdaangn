import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PwaProvider } from "../../components/pwa-provider";
import { PushDeviceProvider } from "../../components/push-device-provider";
import { PushPermissionDialog } from "../../components/push-permission-dialog";
import { PushSettings } from "../../components/push-settings";

function Fixture() {
  const [settings, setSettings] = useState(
    location.search.includes("settings"),
  );
  return (
    <PwaProvider>
      <PushDeviceProvider userId="test-user">
        {settings ? (
          <PushSettings />
        ) : (
          <>
            <PushPermissionDialog />
            <button onClick={() => setSettings(true)}>설정 열기</button>
          </>
        )}
      </PushDeviceProvider>
    </PwaProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
