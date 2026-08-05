# 프롬프트 보관함 (Prompt Vault)

ChatGPT, Gemini, Grok, Claude용 프롬프트를 스마트폰 브라우저에 저장하고 관리하는 오프라인 PWA입니다.

## 주요 기능

- 프롬프트 등록, 조회, 수정, 삭제 및 복제
- 제목 최대 50자 제한
- 동일 제목 프롬프트 자동 버전 관리(v1부터 순차 증가)
- ChatGPT, Gemini, Grok, Claude 분류
- 제목 및 본문 검색
- LLM 필터, 생성일·수정일·제목 정렬
- 즐겨찾기 및 즐겨찾기만 보기
- 본문 원터치 복사 및 클립보드 붙여넣기
- 프롬프트별 이미지 최대 5장 첨부
- 상세 화면 이미지 썸네일 좌우 스크롤
- 전체 화면 이미지 보기, 핀치 확대 및 이동
- 첨부 이미지를 포함한 JSON 백업 및 복원
- 시스템·라이트·다크 테마
- 홈 화면 설치 및 오프라인 실행

프롬프트 변환 기능은 제공하지 않습니다. 저장된 본문은 수정 없이 그대로 복사됩니다.

## 데이터 저장 위치

사용자가 저장한 프롬프트와 첨부 이미지는 서버나 GitHub 저장소로 전송되지 않습니다. 현재 브라우저의 IndexedDB 데이터베이스 `prompt-vault` 안에 저장됩니다.

브라우저 사이트 데이터 삭제, 브라우저 초기화 또는 기기 초기화 시 데이터가 삭제될 수 있으므로 JSON 백업을 정기적으로 보관해야 합니다. 이미지가 포함된 백업 파일은 용량이 커질 수 있습니다.

## GitHub Pages 배포

저장소의 `Settings → Pages → Source`를 `GitHub Actions`로 설정합니다. `main` 브랜치에 변경 사항이 반영되면 `.github/workflows/deploy-pages.yml`이 정적 PWA를 배포합니다.

예상 주소:

```text
https://stafor94.github.io/Prompt-Manager/
```

## 로컬 실행

정적 파일 서버에서 저장소 루트를 제공합니다.

```bash
python -m http.server 8080
```

그다음 브라우저에서 `http://localhost:8080`을 엽니다. `file://` 직접 실행은 Service Worker와 설치 기능이 정상 동작하지 않습니다.
