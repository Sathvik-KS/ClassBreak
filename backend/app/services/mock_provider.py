"""Mock AI provider for development and testing without API keys.

All responses are clearly labeled as mock/sample data.
This provider returns realistic structured data matching the expected schemas.
"""

import uuid
from datetime import datetime, timezone

from app.services.ai_provider import AIProvider


# Sample feed items organized by domain
MOCK_FEED_ITEMS = [
    {
        "title": "The Cocktail Party Effect",
        "hook": "Your brain can pick out your name in a noisy room — even when you're not paying attention. How?",
        "topic": "selective attention",
        "domain": "psychology",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
    {
        "title": "Why Does Rust Never Sleep?",
        "hook": "Iron has been rusting for 3.5 billion years, and it's the reason your blood is red.",
        "topic": "oxidation and iron chemistry",
        "domain": "science",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
    {
        "title": "The Byzantine Generals Problem",
        "hook": "How do you trust a message when the messenger might be a traitor? This puzzle shaped blockchain.",
        "topic": "Byzantine fault tolerance",
        "domain": "computer science",
        "difficulty": "intermediate",
        "estimated_minutes": 10,
    },
    {
        "title": "Wabi-Sabi: Beauty in Imperfection",
        "hook": "Japanese aesthetics teaches that a cracked bowl can be more beautiful than a perfect one.",
        "topic": "wabi-sabi philosophy",
        "domain": "philosophy",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
    {
        "title": "Why Piano Keys Are Black and White",
        "hook": "The piano keyboard layout is a 700-year-old design compromise that still works brilliantly.",
        "topic": "piano keyboard design and music theory",
        "domain": "music",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
    {
        "title": "Kaizen: Tiny Steps, Giant Leaps",
        "hook": "Japanese factories revolutionized the world not with big ideas, but with millions of tiny improvements.",
        "topic": "kaizen continuous improvement",
        "domain": "engineering",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
    {
        "title": "The Dunning-Kruger Effect",
        "hook": "The less you know about something, the more confident you tend to be. Here's why.",
        "topic": "Dunning-Kruger cognitive bias",
        "domain": "psychology",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
    {
        "title": "How Git Actually Works",
        "hook": "Git doesn't store changes — it stores snapshots. This one insight changes everything.",
        "topic": "git internals",
        "domain": "programming",
        "difficulty": "intermediate",
        "estimated_minutes": 10,
    },
    {
        "title": "The Ship of Theseus",
        "hook": "If you replace every plank of a ship, is it still the same ship? Philosophers have argued for 2,500 years.",
        "topic": "Ship of Theseus identity paradox",
        "domain": "philosophy",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
    {
        "title": "Why Japanese Has Three Writing Systems",
        "hook": "Japanese uses hiragana, katakana, AND kanji — and there's a surprisingly practical reason for all three.",
        "topic": "Japanese writing systems",
        "domain": "language",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
    {
        "title": "Attention Is All You Need",
        "hook": "One 2017 paper changed AI forever by showing that 'paying attention' is all a neural network needs.",
        "topic": "transformer architecture",
        "domain": "AI",
        "difficulty": "intermediate",
        "estimated_minutes": 10,
    },
    {
        "title": "The Overview Effect",
        "hook": "Astronauts report a profound cognitive shift when seeing Earth from space — and it changes them permanently.",
        "topic": "overview effect psychology",
        "domain": "psychology",
        "difficulty": "beginner",
        "estimated_minutes": 5,
    },
]

MOCK_LESSON = {
    "title": "The Cocktail Party Effect: How Your Brain Filters Reality",
    "summary": "Discover how your brain unconsciously selects what to hear in noisy environments — and what this reveals about attention and consciousness.",
    "domain": "psychology",
    "difficulty": "beginner",
    "sections": [
        {
            "heading": "What Is the Cocktail Party Effect?",
            "content": "Imagine you're at a crowded party. Dozens of conversations surround you, music plays in the background, glasses clink. Yet somehow, you can focus on the one person talking to you. Even more remarkably, if someone across the room says your name, you'll likely notice it instantly.\n\nThis phenomenon is called the **cocktail party effect**, first described by cognitive scientist Colin Cherry in 1953. It demonstrates your brain's extraordinary ability to filter and prioritize auditory information.\n\n*[MOCK DATA — This lesson is sample content for development. Real lessons are generated from source material by the AI provider.]*",
            "key_points": [
                "Your brain continuously filters sensory information without conscious effort",
                "Named after the observation that we can focus on one voice in a noisy room",
                "First studied scientifically by Colin Cherry in 1953"
            ],
        },
        {
            "heading": "How Selective Attention Works",
            "content": "Your brain processes far more information than you're consciously aware of. The cocktail party effect is powered by **selective attention** — your brain's ability to focus on one source while suppressing others.\n\nCherry's experiments used **dichotic listening**: participants wore headphones playing different messages in each ear and were asked to focus on only one. Most couldn't recall anything from the unattended ear — except their own name.\n\nThis suggests your brain maintains a low-level monitoring of all inputs, even ones you're not consciously attending to. It's like having a background security system that alerts you to important signals.",
            "key_points": [
                "Selective attention lets you focus on one input while filtering others",
                "Dichotic listening experiments proved unattended information is partially processed",
                "Your brain runs 'background monitoring' for personally relevant information"
            ],
        },
        {
            "heading": "Why It Matters Beyond Parties",
            "content": "The cocktail party effect has practical implications far beyond social gatherings:\n\n- **Driving safety**: Understanding why you might miss an ambulance siren when deep in conversation\n- **User interface design**: How notification sounds are designed to break through your attention filter\n- **Hearing aids**: Engineers use this understanding to build better noise-canceling algorithms\n- **Meditation**: Mindfulness training actually changes how your selective attention operates\n\nResearchers at the University of Washington have even built AI systems that mimic the cocktail party effect, separating individual voices from mixed audio recordings.",
            "key_points": [
                "Selective attention affects driving safety and hazard awareness",
                "Technology designers exploit attention mechanisms in UI/UX",
                "AI researchers are building systems that mimic this human ability"
            ],
        },
    ],
    "examples": [
        "When you're reading a book in a café and suddenly hear your name — that's your brain's background monitoring kicking in",
        "Noise-canceling headphones work on a related principle: they don't just block sound, they help your brain's selective attention by removing competing signals"
    ],
    "takeaways": [
        "Your brain is constantly processing more information than you realize",
        "Selective attention is a feature, not a bug — it prevents information overload",
        "Understanding attention helps explain why multitasking is largely a myth"
    ],
    "references": [
        {
            "title": "Cocktail party effect",
            "url": "https://en.wikipedia.org/wiki/Cocktail_party_effect",
            "source_type": "wikipedia"
        },
        {
            "title": "Selective attention",
            "url": "https://en.wikipedia.org/wiki/Selective_attention",
            "source_type": "wikipedia"
        },
    ],
    "related_topics": [
        "Inattentional blindness",
        "Change blindness",
        "Flow state psychology",
        "Multitasking myths"
    ],
}

MOCK_QUIZ_QUESTIONS = [
    {
        "question": "Who first scientifically described the cocktail party effect?",
        "options": ["Daniel Kahneman", "Colin Cherry", "William James", "B.F. Skinner"],
        "correct_answer": "Colin Cherry",
        "explanation": "Colin Cherry first described the cocktail party effect in 1953 through his dichotic listening experiments.",
        "question_type": "multiple_choice",
    },
    {
        "question": "What does the cocktail party effect primarily demonstrate about the brain?",
        "options": [
            "The brain can only process one input at a time",
            "The brain continuously monitors all inputs while focusing on one",
            "Hearing is more important than vision",
            "Social situations improve cognitive function"
        ],
        "correct_answer": "The brain continuously monitors all inputs while focusing on one",
        "explanation": "The cocktail party effect shows that even while focused on one conversation, the brain maintains background monitoring of other inputs — which is why hearing your name across a noisy room is possible.",
        "question_type": "multiple_choice",
    },
    {
        "question": "What research technique did Cherry use to study selective attention?",
        "options": ["Brain scanning", "Dichotic listening", "Eye tracking", "Reaction time tests"],
        "correct_answer": "Dichotic listening",
        "explanation": "Cherry used dichotic listening — playing different audio messages in each ear through headphones and asking participants to attend to only one.",
        "question_type": "multiple_choice",
    },
]


class MockProvider(AIProvider):
    """Mock AI provider that returns realistic sample data for development.
    
    All mock data is clearly labeled. Use this when no AI API key is configured.
    """

    async def generate_lesson(
        self, topic: str, interests: list[str], depth: str,
        duration_minutes: int, source_context: str,
    ) -> dict:
        lesson = dict(MOCK_LESSON)
        lesson["difficulty"] = depth
        if topic.lower() not in ("selective attention", "cocktail party effect"):
            lesson["title"] = f"Understanding {topic.title()} [MOCK]"
            lesson["summary"] = f"A sample lesson about {topic}. This is mock data — real lessons are generated by the AI provider with source grounding."
        return lesson

    async def generate_feed(
        self, interests: list[str], excluded: list[str],
        history_ids: list[str], count: int,
    ) -> list[dict]:
        # Filter by interests if provided, otherwise return all
        items = MOCK_FEED_ITEMS
        if interests:
            interest_lower = {i.lower() for i in interests}
            domain_match = [
                item for item in items
                if item["domain"].lower() in interest_lower
                or any(i in item["topic"].lower() for i in interest_lower)
            ]
            if domain_match:
                items = domain_match

        # Exclude already seen
        if excluded:
            excluded_lower = {e.lower() for e in excluded}
            items = [i for i in items if i["topic"].lower() not in excluded_lower]

        return items[:count]

    async def tutor_chat(
        self, lesson_context: str, conversation_history: str, question: str,
    ) -> dict:
        return {
            "answer": f"That's a great question! Based on the lesson material, here's what I can tell you:\n\n{question} is an interesting aspect of this topic. The key thing to understand is that this relates to how our brains process and filter information.\n\n*[MOCK RESPONSE — Real tutoring responses are generated by the AI provider with lesson context.]*",
            "follow_up_suggestions": [
                "How does this relate to everyday life?",
                "Can you give me an analogy?",
                "What are the practical applications?",
            ],
            "references": [],
        }

    async def generate_quiz(
        self, lesson_content: str, topic: str, difficulty: str, count: int,
    ) -> list[dict]:
        return MOCK_QUIZ_QUESTIONS[:count]

    async def evaluate_answer(
        self, question: str, correct_answer: str,
        user_answer: str, question_type: str,
    ) -> dict:
        if question_type == "multiple_choice":
            is_correct = user_answer.strip().lower() == correct_answer.strip().lower()
            return {
                "is_correct": is_correct,
                "score": 1.0 if is_correct else 0.0,
                "feedback": "Correct! Well done." if is_correct else f"Not quite. The correct answer is: {correct_answer}",
                "correct_answer": correct_answer,
            }
        else:
            # Simple keyword matching for open-ended mock evaluation
            keywords = correct_answer.lower().split()
            matches = sum(1 for k in keywords if k in user_answer.lower())
            score = min(matches / max(len(keywords), 1), 1.0)
            return {
                "is_correct": score >= 0.6,
                "score": round(score, 2),
                "feedback": f"[MOCK EVALUATION] Your answer matched {int(score * 100)}% of key concepts.",
                "correct_answer": correct_answer,
            }
