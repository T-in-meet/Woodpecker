import removeMd from "remove-markdown";

// 저장된 마크다운의 목록 마커는 "1." / "-" 같은 기본 표기로만 남는다.
// 화면에 보이는 a. / i. / ◦ 같은 표기는 tiptap.css가 중첩 깊이로 만들어내므로,
// 미리보기에서도 같은 마커를 보여주려면 여기서 깊이를 계산해 직접 붙여야 한다.
// 깊이별 표기 규칙은 tiptap.css의 ol/ul 중첩 규칙과 짝을 맞춘다.
const ORDERED_MARKER_STYLES = [
  "decimal",
  "lower-alpha",
  "lower-roman",
] as const;
const BULLET_MARKERS = ["•", "◦", "▪"] as const;

// 인용문 안의 목록은 "  > - "처럼 인용 기호가 마커 앞에 붙는다. 화면에서는 인용문이
// 목록 깊이를 끊지 않고 바깥 목록까지 세므로(tiptap.css), 인용 기호도 들여쓰기로 본다.
// 코드 펜스도 인용문 안에 들어갈 수 있으므로 목록과 같은 접두사 규칙을 쓴다.
// 접두사를 허용하지 않으면 "> ```" 안의 "> - literal"이 목록으로 잘못 잡힌다.
const LIST_ITEM_PATTERN = /^([\s>]*)([-+*]|\d+\.)\s+(.*)$/;
const CODE_FENCE_PATTERN = /^[\s>]*(?:```|~~~)/;
// remove-markdown은 코드블록 안을 그대로 두므로 인용 기호가 남는다. 코드 펜스 안에서는
// 여기서 직접 걷어낸다.
const QUOTE_PREFIX_PATTERN = /^\s*(?:>\s?)+/;

const ROMAN_UNITS = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
] as const;

function toLowerAlpha(order: number): string {
  let remaining = order;
  let result = "";

  while (remaining > 0) {
    const index = (remaining - 1) % 26;
    result = String.fromCharCode(97 + index) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return result;
}

function toLowerRoman(order: number): string {
  let remaining = order;
  let result = "";

  for (const [amount, symbol] of ROMAN_UNITS) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }

  return result;
}

function renderOrderedMarker(depth: number, order: number): string {
  const style = ORDERED_MARKER_STYLES[depth % ORDERED_MARKER_STYLES.length];

  if (style === "lower-alpha") return `${toLowerAlpha(order)}.`;
  if (style === "lower-roman") return `${toLowerRoman(order)}.`;

  return `${order}.`;
}

function renderBulletMarker(depth: number): string {
  return BULLET_MARKERS[depth % BULLET_MARKERS.length] ?? "•";
}

type ListLevelType = {
  indent: number;
  ordered: boolean;
  order: number;
};

// 들여쓰기 폭은 목록 종류에 따라 2칸(불릿)과 3칸(번호)이 섞이므로,
// 고정 폭으로 나누지 않고 지금까지 본 들여쓰기를 스택으로 쌓아 깊이를 판정한다.
function restoreListMarkers(markdown: string): string {
  const levels: ListLevelType[] = [];
  let isInsideCodeFence = false;

  return markdown
    .split("\n")
    .map((line) => {
      if (CODE_FENCE_PATTERN.test(line)) {
        isInsideCodeFence = !isInsideCodeFence;

        // 백틱 펜스는 마지막 정리 단계에서 지워지지만 "~~~"는 취소선으로 오인돼
        // "~"가 남으므로 여기서 걷어낸다.
        return line.replace(QUOTE_PREFIX_PATTERN, "").replace(/^~~~+/, "");
      }

      if (isInsideCodeFence) return line.replace(QUOTE_PREFIX_PATTERN, "");

      const match = LIST_ITEM_PATTERN.exec(line);

      if (!match) {
        // 목록 바깥의 본문을 만나면 깊이를 버린다. 빈 줄과 들여쓴 줄은 느슨한 목록이나
        // 항목 내부 문단에서도 나오므로 목록이 끝났다고 보지 않는다.
        if (line.trim() !== "" && !line.startsWith(" ")) levels.length = 0;

        return line;
      }

      const [, indentText = "", marker = "", content = ""] = match;
      const indent = indentText.length;
      const ordered = marker.endsWith(".");
      // 목록의 시작 번호는 마커가 그대로 들고 있다(예: "100."). 화면도 ol의 start를
      // 반영해 그 번호부터 세므로, 목록이 새로 열릴 때는 1이 아니라 이 번호에서 시작한다.
      // 자릿수가 달라 마커가 오른쪽 정렬로 저장된 목록(" 9." / "10.")은 줄마다 들여쓰기가
      // 달라 아래에서 단계를 다시 열게 되는데, 그때도 이 번호 덕분에 순번이 이어진다.
      const parsedStart = Number.parseInt(marker, 10);
      const startOrder = Number.isFinite(parsedStart) ? parsedStart : 1;

      while (levels.length > 0) {
        const deepest = levels[levels.length - 1];

        if (!deepest || deepest.indent <= indent) break;

        levels.pop();
      }

      const deepest = levels[levels.length - 1];

      if (!deepest || deepest.indent < indent) {
        levels.push({ indent, ordered, order: startOrder });
      } else if (deepest.ordered !== ordered) {
        // 같은 깊이에서 목록 종류가 바뀌면 새 목록으로 보고 번호를 다시 센다.
        deepest.ordered = ordered;
        deepest.order = startOrder;
      } else {
        deepest.order += 1;
      }

      const current = levels[levels.length - 1];

      if (!current) return line;

      const depth = levels.length - 1;
      const restoredMarker = current.ordered
        ? renderOrderedMarker(depth, current.order)
        : renderBulletMarker(depth);

      // 미리보기는 한 줄로 평탄화되므로 들여쓰기는 남기지 않는다. 깊이는 마커가 나타낸다.
      return `${restoredMarker} ${content}`;
    })
    .join("\n");
}

export function stripMarkdown(text: string): string {
  const preprocessed = restoreListMarkers(
    text
      // CRLF가 섞여 저장된 본문은 줄 끝에 남은 \r 때문에 목록 마커 패턴이 어긋난다.
      .replace(/\r\n?/g, "\n")
      .replace(/\[[ xX]\]/g, "")
      .replace(/^\|[\s\-|:]+\|$/gm, "")
      .replace(/\|/g, " "),
  );

  // 마커를 위에서 이미 복원했으므로 remove-markdown이 다시 걷어내지 않게 한다.
  return removeMd(preprocessed, { stripListLeaders: false })
    .replace(/`/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}
