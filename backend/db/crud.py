import logging

from db.database import get_session_factory
from db.models import ChatSession
from schemas import SummaryResult

logger = logging.getLogger(__name__)


async def save_chat_summary(user_message: str, summary_result: SummaryResult | None) -> None:
    """Persist a chat session summary to the database.

    Silently skips when DATABASE_URL is not configured or on any DB error so
    that a storage failure never breaks the API response.
    """
    session_factory = get_session_factory()
    if session_factory is None:
        return

    try:
        async with session_factory() as session:
            record = ChatSession(
                user_message=user_message,
                summary=summary_result.summary if summary_result else None,
                winner=summary_result.winner if summary_result else None,
                is_tie=summary_result.is_tie if summary_result else False,
            )
            session.add(record)
            await session.commit()
    except Exception:
        logger.exception("Failed to save chat summary to database")
