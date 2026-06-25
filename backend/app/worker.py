from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "artisan",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "cleanup-temp-images-nightly": {
            "task": "app.tasks.cleanup.cleanup_expired_temp_images",
            "schedule": 86400.0,  # every 24 hours (3am UTC handled by deployment offset)
        },
    },
)
