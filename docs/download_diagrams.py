import urllib.request
import base64
import os
import time

diagram1 = '''erDiagram
    USERS {
        ObjectId _id PK
        String username UK "unique lowercase 3-16 chars"
        String fullName
        Date dob
        String gender "male or female"
        String passwordHash "Argon2id"
        String role "player or admin"
        Number highScore
        Array badges
        Boolean insaneUnlocked
        Boolean skyfallInsaneUnlocked
        Boolean invaderInsaneUnlocked
        Date createdAt
    }

    SCORES {
        ObjectId _id PK
        ObjectId userId FK "ref: Users"
        String username
        Number score
        String difficulty "EASY to INSANE"
        String mode "skyfall or space-invader"
        Date createdAt
    }

    CURRICULA {
        String curriculum_id PK "e.g. cmo-math-olympiad"
        String name "Crest Mathematics Olympiad"
        String board "CREST"
        String country "India"
        Array standards "subjects topics difficulties"
    }

    QUESTION_REPORTS {
        ObjectId _id PK
        Mixed question_id FK
        Mixed reported_by FK "ref: Users"
        String reason
        String status "pending resolved dismissed"
        Date createdAt
    }

    USERS ||--o{ SCORES : "submits"
    USERS ||--o{ QUESTION_REPORTS : "reports"
    CURRICULA ||--o{ USERS : "studies"
'''

diagram2 = '''erDiagram
    USERS {
        ObjectId _id PK
        String username UK
        String role "admin"
    }

    GENERATION_BATCHES {
        String batch_id PK "UUID"
        String idempotency_key UK "sparse"
        String request_hash "SHA-256"
        String status "pending generating validating completed failed"
        Number requested_count "1 to 50"
        Number generated_count
        Date createdAt
    }

    GENERATED_QUESTIONS {
        String question_id PK "UUID"
        String batch_id FK "ref: GenerationBatch"
        String question_text
        String question_type "multiple_choice"
        Array options "4 option objects"
        String correct_option_id "A B C D"
        Mixed correct_answer "value and type"
        String status "pending_review approved published rejected"
        Number published_id UK "sparse 1001+"
        String rejection_reason
    }

    VALIDATION_RESULTS {
        ObjectId _id PK
        String question_id FK "ref: GeneratedQuestion"
        Boolean schema_valid
        Boolean answer_valid "AST math check"
        Mixed recalculated_value "ground-truth"
        String duplicate_check "passed flagged_near flagged_exact"
        Number similarity_score "0.0 to 1.0"
        String overall_status "pending_review or failed"
    }

    AUDIT_LOGS {
        ObjectId _id PK
        Mixed actor_id "User ID or SYSTEM_CLI"
        String action "GENERATE APPROVE REJECT PUBLISH"
        String target_collection
        String target_id
        Object details
        Date createdAt
    }

    COUNTERS {
        String _id PK "published_question_id"
        Number seq "starts at 1000 inc to 1001+"
    }

    SOURCE_DOCUMENTS {
        ObjectId _id PK
        String filename
        String filepath
        Date uploadedAt
    }

    USERS ||--o{ GENERATION_BATCHES : "triggers"
    GENERATION_BATCHES ||--o{ GENERATED_QUESTIONS : "produces"
    GENERATED_QUESTIONS ||--|| VALIDATION_RESULTS : "validated by"
    USERS ||--o{ AUDIT_LOGS : "recorded as actor"
    GENERATED_QUESTIONS ||--o| AUDIT_LOGS : "tracked in"
    COUNTERS ||--o{ GENERATED_QUESTIONS : "assigns published_id"
    SOURCE_DOCUMENTS ||--o{ GENERATION_BATCHES : "feeds into"
'''

docs_dir = r'c:\Users\devic\Downloads\Major_Project_2\MindRush-main\docs\diagrams'
brain_dir = r'C:\Users\devic\.gemini\antigravity\brain\5b95a7c0-46e7-440a-a2dd-a23a50f269e0'

os.makedirs(docs_dir, exist_ok=True)
os.makedirs(brain_dir, exist_ok=True)

targets = [
    ('erd_player_gameplay', diagram1),
    ('erd_admin_ai_pipeline', diagram2)
]

for name, code in targets:
    b64 = base64.b64encode(code.strip().encode('utf-8')).decode('ascii')
    
    # 1. Download SVG
    svg_url = f'https://mermaid.ink/svg/{b64}'
    print(f'Fetching SVG for {name}...')
    try:
        req = urllib.request.Request(svg_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = resp.read()
            for d in [docs_dir, brain_dir]:
                with open(os.path.join(d, f'{name}.svg'), 'wb') as f:
                    f.write(data)
            print(f'  [OK] Saved SVG {name} ({len(data)} bytes)')
    except Exception as e:
        print(f'  [FAIL] Error fetching SVG {name}: {e}')

    time.sleep(1)

    # 2. Download PNG
    png_url = f'https://mermaid.ink/img/{b64}'
    print(f'Fetching PNG for {name}...')
    try:
        req = urllib.request.Request(png_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = resp.read()
            for d in [docs_dir, brain_dir]:
                with open(os.path.join(d, f'{name}.png'), 'wb') as f:
                    f.write(data)
            print(f'  [OK] Saved PNG {name} ({len(data)} bytes)')
    except Exception as e:
        print(f'  [FAIL] Error fetching PNG {name}: {e}')

    time.sleep(1)

print('Process complete!')
