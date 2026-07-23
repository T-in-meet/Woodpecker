import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    // NOTE:
    // matchMedia("change") 이벤트는 일부 환경에서 브라우저 크기 변경 시
    // 호출되지 않는 문제가 있어, resize 이벤트를 이용해 모바일 여부를 갱신한다.
    // (증상: 모바일 → 데스크톱 전환 시 Sidebar가 Drawer 상태로 유지되고,
    // 새로고침 후에만 정상적으로 Desktop Sidebar로 변경됨.)
    const update = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    update();

    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobile;
}
