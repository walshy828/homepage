"""
Homepage Dashboard - Integrations Router
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.models import User
from app.schemas import DockerResponse, ProxmoxResponse, WeatherResponse
from app.api.dependencies import get_current_user
from app.services import docker_service, proxmox_service, weather_service


router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ============== Docker ==============

@router.get("/docker", response_model=DockerResponse)
async def get_docker_status(
    include_stats: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get Docker container status."""
    if not docker_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Docker is not available"
        )
    
    return docker_service.get_containers(include_stats=include_stats)


@router.post("/docker/{container_id}/start")
async def start_docker_container(
    container_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start a Docker container."""
    if not docker_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Docker is not available"
        )
    
    success = docker_service.start_container(container_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start container"
        )
    
    return {"status": "started"}


@router.post("/docker/{container_id}/stop")
async def stop_docker_container(
    container_id: str,
    current_user: User = Depends(get_current_user)
):
    """Stop a Docker container."""
    if not docker_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Docker is not available"
        )
    
    success = docker_service.stop_container(container_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop container"
        )
    
    return {"status": "stopped"}


@router.post("/docker/{container_id}/restart")
async def restart_docker_container(
    container_id: str,
    current_user: User = Depends(get_current_user)
):
    """Restart a Docker container."""
    if not docker_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Docker is not available"
        )
    
    success = docker_service.restart_container(container_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restart container"
        )
    
    return {"status": "restarted"}


# ============== Proxmox ==============

@router.get("/proxmox", response_model=ProxmoxResponse)
async def get_proxmox_status(
    current_user: User = Depends(get_current_user)
):
    """Get Proxmox cluster status."""
    if not proxmox_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Proxmox is not available or not configured"
        )
    
    return proxmox_service.get_status()


@router.post("/proxmox/{node}/{vm_type}/{vmid}/start")
async def start_proxmox_vm(
    node: str,
    vm_type: str,
    vmid: int,
    current_user: User = Depends(get_current_user)
):
    """Start a Proxmox VM or container."""
    if vm_type not in ["qemu", "lxc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="vm_type must be 'qemu' or 'lxc'"
        )
    
    if not proxmox_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Proxmox is not available"
        )
    
    success = proxmox_service.start_vm(node, vmid, vm_type)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start VM/container"
        )
    
    return {"status": "started"}


@router.post("/proxmox/{node}/{vm_type}/{vmid}/stop")
async def stop_proxmox_vm(
    node: str,
    vm_type: str,
    vmid: int,
    current_user: User = Depends(get_current_user)
):
    """Stop a Proxmox VM or container."""
    if vm_type not in ["qemu", "lxc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="vm_type must be 'qemu' or 'lxc'"
        )
    
    if not proxmox_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Proxmox is not available"
        )
    
    success = proxmox_service.stop_vm(node, vmid, vm_type)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stop VM/container"
        )
    
    return {"status": "stopped"}


# ============== Weather ==============

@router.get("/weather/{location}", response_model=WeatherResponse)
async def get_weather(
    location: str,
    current_user: User = Depends(get_current_user)
):
    """Get weather for a location."""
    if not weather_service.is_available:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Weather service is not configured"
        )
    
    weather = await weather_service.get_weather(location)
    if not weather:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not fetch weather for this location"
        )
    
    return weather


# ============== Status ==============

@router.get("/status")
async def get_integration_status(
    current_user: User = Depends(get_current_user)
):
    """Get status of all integrations."""
    return {
        "docker": {
            "available": docker_service.is_available,
            "type": "local" if docker_service.is_available else None
        },
        "proxmox": {
            "available": proxmox_service.is_available,
            "configured": proxmox_service._api is not None
        },
        "weather": {
            "available": weather_service.is_available
        },
        "ai": {
            "available": True,  # Will import gemini_service when needed
            "model": "gemini-2.5-flash"
        }
    }
