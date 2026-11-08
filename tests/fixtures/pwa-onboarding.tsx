import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PwaProvider } from "../../components/pwa-provider";
import { PushDeviceProvider } from "../../components/push-device-provider";
import { PushPermissionDialog } from "../../components/push-permission-dialog";
import { PushSettings } from "../../components/push-settings";
import { InstallEntry } from "../../components/install-entry";

function Fixture() {
  const [settings, setSettings] = useState(
    location.search.includes("settings"),
  );
  if (location.search.includes("install-entry"))
    return (
      <PwaProvider>
        <div className="landing-copy">
          <InstallEntry landing={location.search.includes("landing")} />
        </div>
      </PwaProvider>
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
