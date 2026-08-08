import { describe, expect, it } from "vitest";

import { gradeBlankAnswer, normalizeAnswer } from "../grading";

describe("normalizeAnswer", () => {
  it("앞뒤 공백을 제거한다", () => {
    expect(normalizeAnswer("  레지스터  ")).toBe("레지스터");
  });

  it("대소문자를 통일한다", () => {
    expect(normalizeAnswer("Register")).toBe("register");
  });

  it("중간 공백을 제거한다", () => {
    expect(normalizeAnswer("main memory")).toBe("mainmemory");
  });

  it("문장부호를 제거한다", () => {
    expect(normalizeAnswer("레지스터.")).toBe("레지스터");
  });

  it("하이픈과 언더스코어를 제거한다", () => {
    expect(normalizeAnswer("e-mail")).toBe("email");
    expect(normalizeAnswer("page_fault")).toBe("pagefault");
  });

  it("가운뎃점을 제거한다", () => {
    expect(normalizeAnswer("산술·논리")).toBe("산술논리");
  });

  it("슬래시를 제거한다", () => {
    expect(normalizeAnswer("TCP/IP")).toBe("tcpip");
    expect(normalizeAnswer("I/O")).toBe("io");
    expect(normalizeAnswer("C:\\Windows")).toBe("cwindows");
  });

  it("전각 문장부호도 제거한다", () => {
    expect(normalizeAnswer("TCP／IP")).toBe("tcpip");
    expect(normalizeAnswer("레지스터…")).toBe("레지스터");
    expect(normalizeAnswer("입력、출력")).toBe("입력출력");
  });

  it("기호는 남긴다", () => {
    // +를 지우면 C++와 C가 같은 답이 된다.
    expect(normalizeAnswer("C++")).toBe("c++");
    expect(normalizeAnswer("a=b")).toBe("a=b");
  });

  it("뜻을 담는 문장부호는 남긴다", () => {
    expect(normalizeAnswer("C#")).toBe("c#");
    expect(normalizeAnswer("F#")).toBe("f#");
    expect(normalizeAnswer("50%")).toBe("50%");
    expect(normalizeAnswer("R&D")).toBe("r&d");
    expect(normalizeAnswer("A*")).toBe("a*");
  });

  it("남기는 문자와 지우는 문자가 섞여 있어도 구분한다", () => {
    expect(normalizeAnswer("C#, 그리고...")).toBe("c#그리고");
  });

  describe("수치를 가르는 문장부호는 남긴다", () => {
    it("숫자 사이의 소수점·슬래시·콜론·하이픈을 남긴다", () => {
      expect(normalizeAnswer("3.14")).toBe("3.14");
      expect(normalizeAnswer("1/2")).toBe("1/2");
      expect(normalizeAnswer("1:2")).toBe("1:2");
      expect(normalizeAnswer("2-3")).toBe("2-3");
      expect(normalizeAnswer("v1.2")).toBe("v1.2");
    });

    it("맨 앞의 부호를 남긴다", () => {
      expect(normalizeAnswer("-1")).toBe("-1");
    });

    it("숫자에 붙지 않은 같은 문자는 그대로 지운다", () => {
      // 끝에 온 마침표는 값을 가르지 않는다.
      expect(normalizeAnswer("3.14.")).toBe("3.14");
      // 문자와 숫자를 잇는 하이픈까지 남기면 하이픈을 뺀 입력이 오답이 된다.
      expect(normalizeAnswer("COVID-19")).toBe("covid19");
      expect(normalizeAnswer("RS-232")).toBe("rs232");
    });

    it("자릿수 쉼표는 지운다", () => {
      expect(normalizeAnswer("1,000")).toBe("1000");
    });

    it("지수부의 부호를 남긴다", () => {
      // 1e-3과 1e3은 1000배 차이다.
      expect(normalizeAnswer("1e-3")).toBe("1e-3");
      expect(normalizeAnswer("1e3")).toBe("1e3");
    });

    it("정수부를 생략한 소수를 0으로 채운다", () => {
      expect(normalizeAnswer(".5")).toBe("0.5");
      expect(normalizeAnswer("-.5")).toBe("-0.5");
    });
  });

  describe("전각·유니코드 변형을 ASCII로 맞춘다", () => {
    it("전각 문장부호를 반각으로 편다", () => {
      expect(normalizeAnswer("1／2")).toBe("1/2");
      expect(normalizeAnswer("3．14")).toBe("3.14");
      expect(normalizeAnswer("1：2")).toBe("1:2");
    });

    it("전각 숫자를 반각으로 편다", () => {
      expect(normalizeAnswer("３．１４")).toBe("3.14");
    });

    it("dash 변형을 하이픈으로 통일한다", () => {
      expect(normalizeAnswer("2–3")).toBe("2-3");
      expect(normalizeAnswer("2—3")).toBe("2-3");
      expect(normalizeAnswer("－1")).toBe("-1");
      expect(normalizeAnswer("−1")).toBe("-1");
    });

    it("위첨자를 지수 표기로 바꾼다", () => {
      // NFKC에 그냥 맡기면 10²가 102로 펴져 102와 같은 답이 된다.
      expect(normalizeAnswer("10²")).toBe("10^2");
      expect(normalizeAnswer("2¹⁰")).toBe("2^10");
      expect(normalizeAnswer("10^2")).toBe("10^2");
    });

    it("분수 기호를 슬래시 표기로 바꾼다", () => {
      expect(normalizeAnswer("½")).toBe("1/2");
    });
  });
});

describe("gradeBlankAnswer", () => {
  it("정답과 정확히 일치하면 통과한다", () => {
    expect(gradeBlankAnswer("레지스터", "레지스터", [])).toBe(true);
  });

  it("빈 입력은 오답이다", () => {
    expect(gradeBlankAnswer("   ", "레지스터", ["register"])).toBe(false);
  });

  it("틀린 답은 오답이다", () => {
    expect(gradeBlankAnswer("캐시", "레지스터", ["register"])).toBe(false);
  });

  describe("acceptedAnswers", () => {
    it("영어 원어 입력을 정답으로 인정한다", () => {
      expect(gradeBlankAnswer("register", "레지스터", ["register"])).toBe(true);
    });

    it("대소문자가 달라도 인정한다", () => {
      expect(gradeBlankAnswer("REGISTER", "레지스터", ["register"])).toBe(true);
    });

    it("음차 표기 변형을 인정한다", () => {
      expect(gradeBlankAnswer("클락", "클럭", ["clock", "클락", "클록"])).toBe(
        true,
      );
    });

    it("약어를 인정한다", () => {
      expect(gradeBlankAnswer("db", "데이터베이스", ["DB", "database"])).toBe(
        true,
      );
    });

    it("띄어쓰기가 달라도 인정한다", () => {
      expect(
        gradeBlankAnswer("MainMemory", "주기억장치", ["main memory"]),
      ).toBe(true);
    });

    it("acceptedAnswers가 비어 있으면 정답만 인정한다", () => {
      expect(gradeBlankAnswer("register", "레지스터", [])).toBe(false);
    });

    it("슬래시를 빼고 입력해도 인정한다", () => {
      // 프롬프트가 문장부호 변형은 acceptedAnswers에 넣지 말라고 하므로 채점이 흡수해야 한다.
      expect(gradeBlankAnswer("TCPIP", "TCP/IP", [])).toBe(true);
    });

    it("기호가 다르면 오답이다", () => {
      expect(gradeBlankAnswer("C", "C++", [])).toBe(false);
    });

    it("샵을 빼고 입력하면 오답이다", () => {
      expect(gradeBlankAnswer("C", "C#", [])).toBe(false);
      expect(gradeBlankAnswer("F", "F#", [])).toBe(false);
    });

    it("수치의 문장부호를 빼고 입력하면 오답이다", () => {
      expect(gradeBlankAnswer("314", "3.14", [])).toBe(false);
      expect(gradeBlankAnswer("12", "1/2", [])).toBe(false);
      expect(gradeBlankAnswer("12", "1:2", [])).toBe(false);
      expect(gradeBlankAnswer("1", "-1", [])).toBe(false);
      expect(gradeBlankAnswer("v12", "v1.2", [])).toBe(false);
    });

    it("하이픈을 빼고 입력해도 인정한다", () => {
      expect(gradeBlankAnswer("covid19", "COVID-19", [])).toBe(true);
    });

    it("지수부 부호가 다르면 오답이다", () => {
      expect(gradeBlankAnswer("1e3", "1e-3", [])).toBe(false);
    });

    it("정수부를 생략한 소수를 인정한다", () => {
      expect(gradeBlankAnswer(".5", "0.5", [])).toBe(true);
      expect(gradeBlankAnswer("5", "0.5", [])).toBe(false);
    });

    it("전각으로 입력해도 인정한다", () => {
      expect(gradeBlankAnswer("１／２", "1/2", [])).toBe(true);
      expect(gradeBlankAnswer("ＴＣＰ／ＩＰ", "TCP/IP", [])).toBe(true);
    });

    it("위첨자 대신 캐럿으로 입력해도 인정한다", () => {
      expect(gradeBlankAnswer("10^2", "10²", [])).toBe(true);
      expect(gradeBlankAnswer("102", "10²", [])).toBe(false);
    });
  });
});
