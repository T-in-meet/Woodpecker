export type AdminAiSetting = {
  id: string;
  displayName: string;
  key: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAiSettingInfo = {
  displayName: string;
  key: string;
  description: string;
};

/**
 * @description AI 설정 생성 및 수정에 사용하는 기본 정보입니다.
 */
export type AdminAiSettingInfoFormValues = {
  setting: AdminAiSettingInfo;
};

/**
 * @description AI 설정에 연결할 Chat 또는 Embedding 구성입니다.
 */
export type AdminAiSettingConfiguration =
  | {
      kind: "chat";
      roleKey: string;
      agentId: string;
      promptFamilyId: string;
      promptVersionId: string;
      modelConfigId: string;
      temperature: number;
    }
  | {
      kind: "embedding";
      roleKey: string;
      modelConfigId: string;
    };

/**
 * @description AI 구성 관리 폼 값입니다.
 */
export type AdminAiSettingConfigurationFormValues = {
  /** AI 설정에 연결된 Chat 및 Embedding 구성 목록입니다. */
  configurations: AdminAiSettingConfiguration[];
};
