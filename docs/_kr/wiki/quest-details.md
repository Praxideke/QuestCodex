---
title: 퀘스트 상세
parent: 위키
nav_order: 2
---

# 퀘스트 상세
{: .no_toc }

1. TOC
{:toc}

---

## 행 펼치기

퀘스트 행을 누르면 그 자리에서 펼쳐지며 목표, 시작 조건, 보상(수락 시·실패 시 보상 포함), 선행·후속 퀘스트가
보입니다. 여러 행을 동시에 펼쳐 둘 수 있습니다.

[![펼친 퀘스트]({{ '/assets/images/wiki-quest-detail.png' | relative_url }})]({{ '/assets/images/wiki-quest-detail.png' | relative_url }})

## 연계 이동

펼친 행에서 선행(Requires)이나 후속(Unlocks) 퀘스트 이름을 누르면 그 퀘스트로 바로 이동합니다.

## 설명 팝업

**퀘스트 설명 보기**(View description)를 누르면 전체 설명이 팝업으로 열려서, 긴 글 때문에 목록이 늘어나지 않습니다.

[![설명 팝업]({{ '/assets/images/wiki-description.png' | relative_url }})]({{ '/assets/images/wiki-description.png' | relative_url }})

## 택일 분기 경고

어떤 퀘스트는 서로 배타적인 분기에 있어서, 하나를 완료하면 다른 퀘스트가 실패하거나 막힙니다.
이런 퀘스트는 목록에서 **분기**(branch) 태그가 붙고, 상세에서 어떤 퀘스트가 막히는지 경고해 줍니다.

[![택일 분기 경고]({{ '/assets/images/wiki-branch.png' | relative_url }})]({{ '/assets/images/wiki-branch.png' | relative_url }})

## 모드 출처 표시

모드 퀘스트에는 어느 모드에서 왔는지 모드 이름이 모드별 색으로 붙습니다.

[![모드 태그가 붙은 모드 퀘스트]({{ '/assets/images/wiki-mod-list.png' | relative_url }})]({{ '/assets/images/wiki-mod-list.png' | relative_url }})

{: .note-kr }
JSON 파일이 아니라 C# 코드로 추가된 모드 퀘스트는 파일 흔적이 없어서 출처 모드를 알 수 없습니다.
이런 퀘스트에는 모드 이름 대신 `모드` 태그가 붙습니다.
