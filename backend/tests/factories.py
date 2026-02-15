# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

from datetime import date
from decimal import Decimal

from polyfactory import Use
from polyfactory.factories.sqlalchemy_factory import SQLAlchemyFactory

from app.models.factory import Factory
from app.models.datasource import DataSource
from app.models.production import Order, OrderStatus, ProductionRun, ShiftType, Style
from app.models.user import Organization, User, UserRole


class OrganizationFactory(SQLAlchemyFactory[Organization]):
    __model__ = Organization

    name = Use(lambda: f"Org {SQLAlchemyFactory.__random__.get_random_bytes(4).hex()}")
    code = Use(lambda: f"CODE-{SQLAlchemyFactory.__random__.get_random_bytes(2).hex()}")


class UserFactory(SQLAlchemyFactory[User]):
    __model__ = User

    email = Use(
        lambda: f"user-{SQLAlchemyFactory.__random__.get_random_bytes(4).hex()}@example.com"
    )
    hashed_password = "hashed_password"
    full_name = "Test User"
    role = UserRole.ADMIN


class FactoryFactory(SQLAlchemyFactory[Factory]):
    __model__ = Factory

    name = Use(
        lambda: f"Factory {SQLAlchemyFactory.__random__.get_random_bytes(4).hex()}"
    )
    code = Use(lambda: f"F-{SQLAlchemyFactory.__random__.get_random_bytes(2).hex()}")
    country = "Test Country"
    timezone = "UTC"
    organization_id = OrganizationFactory


class DataSourceFactory(SQLAlchemyFactory[DataSource]):
    __model__ = DataSource

    name = Use(lambda: f"Line {SQLAlchemyFactory.__random__.get_random_bytes(2).hex()}")
    code = Use(lambda: f"L-{SQLAlchemyFactory.__random__.get_random_bytes(2).hex()}")
    factory_id = FactoryFactory


class StyleFactory(SQLAlchemyFactory[Style]):
    __model__ = Style

    style_number = Use(
        lambda: f"ST-{SQLAlchemyFactory.__random__.get_random_bytes(4).hex().upper()}"
    )
    base_sam = Use(lambda: Decimal("1.5"))
    factory_id = FactoryFactory


class OrderFactory(SQLAlchemyFactory[Order]):
    __model__ = Order

    po_number = Use(
        lambda: f"PO-{SQLAlchemyFactory.__random__.get_random_bytes(4).hex().upper()}"
    )
    quantity = Use(lambda: 1000)
    status = OrderStatus.PENDING
    style_id = StyleFactory


class ProductionRunFactory(SQLAlchemyFactory[ProductionRun]):
    __model__ = ProductionRun

    production_date = Use(lambda: date.today())
    shift = ShiftType.DAY
    actual_qty = Use(lambda: 450)
    planned_qty = Use(lambda: 500)
    sam = Use(lambda: Decimal("1.5"))
    operators_present = 10
    helpers_present = 2
    worked_minutes = Use(lambda: Decimal("4800.0"))
    factory_id = FactoryFactory
    order_id = OrderFactory
    data_source_id = DataSourceFactory
