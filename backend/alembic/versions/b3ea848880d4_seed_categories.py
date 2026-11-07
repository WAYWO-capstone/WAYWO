"""seed categories

Revision ID: b3ea848880d4
Revises: c6d2f905b8e1
Create Date: 2026-11-06

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3ea848880d4'
down_revision: Union[str, Sequence[str], None] = 'c6d2f905b8e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CATEGORY_NAMESPACE = uuid.UUID("be18c1c2-a720-4438-a3bc-3263b9ae616b")

CATEGORIES = [
    # Building & making
    {"name": "Woodworking", "description": "Carpentry, joinery, and projects built primarily from wood."},
    {"name": "Furniture", "description": "Tables, chairs, shelves, and other furniture, built or restored."},
    {"name": "Metalworking & Welding", "description": "Fabrication, welding, forging, and machining."},
    {"name": "Laser Cutting & CNC", "description": "Laser cutters, CNC routers, and other computer-controlled fabrication."},
    {"name": "3D Printing", "description": "Printed parts, models, and printer builds or upgrades."},
    {"name": "Tools & Workshop", "description": "Jigs, tool builds, workshop setups, and shop organization."},

    # Tech
    {"name": "Electronics", "description": "Circuits, microcontrollers, and electronic gadgets."},
    {"name": "Robotics & Drones", "description": "Robots, RC vehicles, drones, and motion control."},
    {"name": "Smart Home & IoT", "description": "Home automation, sensors, and connected devices."},
    {"name": "Software & Coding", "description": "Apps, scripts, games, and other software projects."},
    {"name": "Audio & Music", "description": "Instruments, speakers, amps, synths, and audio gear."},
    {"name": "Photography & Video", "description": "Camera rigs, lighting setups, and DIY studio gear."},

    # Home
    {"name": "Home Improvement & Repair", "description": "Renovations, repairs, and upgrades around the house."},
    {"name": "Home Decor", "description": "Decorative pieces, wall art, and styling for living spaces."},
    {"name": "Lighting", "description": "Lamps, fixtures, and lighting installations."},
    {"name": "Gardening & Landscaping", "description": "Planters, raised beds, and outdoor growing or yard projects."},
    {"name": "Kitchen & Cooking", "description": "Kitchen builds, cookware, food, and brewing projects."},

    # Textiles & crafts
    {"name": "Sewing & Garment Making", "description": "Clothing, bags, and other sewn items."},
    {"name": "Knitting & Crochet", "description": "Yarn and fiber arts, including weaving and macramé."},
    {"name": "Leatherworking", "description": "Wallets, bags, belts, and other leather goods."},
    {"name": "Paper Crafts & Printing", "description": "Papercraft, bookbinding, screen printing, and stationery."},
    {"name": "Painting & Drawing", "description": "Painting, illustration, murals, and other visual art."},
    {"name": "Ceramics, Clay & Glass", "description": "Pottery, polymer clay, resin, glasswork, and mosaics."},
    {"name": "Jewelry & Accessories", "description": "Jewelry, watches, and wearable accessories."},

    # Vehicles & outdoors
    {"name": "Automotive & Motorcycles", "description": "Car and motorcycle repairs, mods, and builds."},
    {"name": "Bicycles & Mobility", "description": "Bike builds and repairs, e-bikes, scooters, and other personal transport."},
    {"name": "Outdoors & Camping", "description": "Camping gear, boats, van builds, and outdoor equipment."},

    # Play, people & pets
    {"name": "Toys, Games & Models", "description": "Toys, board games, miniatures, and scale models."},
    {"name": "Cosplay & Props", "description": "Costumes, armor, props, and special effects."},
    {"name": "Kids & Education", "description": "Learning projects, teaching aids, and things made for or with kids."},
    {"name": "Pets & Animals", "description": "Pet furniture, enclosures, toys, and animal care projects."},

    # Approach
    {"name": "Upcycling & Repurposing", "description": "Giving old or discarded items a new purpose."},
    {"name": "Other", "description": "Projects that don't fit any other category."},
]


def upgrade() -> None:
    """Upgrade schema."""
    categories = sa.table(
        "categories",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String(length=100)),
        sa.column("description", sa.Text()),
    )
    existing_names = set(
        op.get_bind().execute(sa.select(categories.c.name)).scalars()
    )
    missing_categories = [
        {
            "id": uuid.uuid5(CATEGORY_NAMESPACE, category["name"]),
            **category,
        }
        for category in CATEGORIES
        if category["name"] not in existing_names
    ]
    if missing_categories:
        op.bulk_insert(categories, missing_categories)


def downgrade() -> None:
    """Downgrade schema."""
    categories = sa.table(
        "categories",
        sa.column("name", sa.String(length=100)),
    )
    category_names = [category["name"] for category in CATEGORIES]
    op.execute(categories.delete().where(categories.c.name.in_(category_names)))
