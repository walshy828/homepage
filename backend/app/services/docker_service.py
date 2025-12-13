"""
Homepage Dashboard - Docker Service
"""
from datetime import datetime
from typing import List, Optional
import docker
from docker.errors import DockerException

from app.core.config import settings
from app.schemas import DockerContainer, DockerResponse


class DockerService:
    """Service for Docker container monitoring."""
    
    def __init__(self):
        self._client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Docker client."""
        try:
            if settings.docker_host:
                self._client = docker.DockerClient(base_url=settings.docker_host)
            else:
                self._client = docker.from_env()
        except DockerException as e:
            print(f"Docker client initialization failed: {e}")
            self._client = None
    
    @property
    def is_available(self) -> bool:
        """Check if Docker is available."""
        # Retry initialization if client is None
        if self._client is None:
            self._initialize_client()
        
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            # Try to reinitialize
            self._initialize_client()
            if self._client:
                try:
                    self._client.ping()
                    return True
                except Exception:
                    pass
            return False
    
    def get_containers(self, include_stats: bool = True) -> DockerResponse:
        """Get list of all containers with optional stats."""
        if not self.is_available:
            return DockerResponse(containers=[], total_containers=0, running_containers=0)
        
        try:
            containers = self._client.containers.list(all=True)
            container_list = []
            running_count = 0
            
            for container in containers:
                # Get container info
                info = container.attrs
                created = datetime.fromisoformat(info["Created"].replace("Z", "+00:00"))
                
                # Parse ports
                ports = []
                if info.get("NetworkSettings", {}).get("Ports"):
                    for container_port, host_bindings in info["NetworkSettings"]["Ports"].items():
                        if host_bindings:
                            for binding in host_bindings:
                                ports.append({
                                    "container_port": container_port,
                                    "host_ip": binding.get("HostIp", "0.0.0.0"),
                                    "host_port": binding.get("HostPort")
                                })
                
                container_data = DockerContainer(
                    id=container.short_id,
                    name=container.name,
                    image=container.image.tags[0] if container.image.tags else container.image.short_id,
                    status=container.status,
                    state=info["State"]["Status"],
                    created=created,
                    ports=ports
                )
                
                # Get stats if requested and container is running
                if include_stats and container.status == "running":
                    running_count += 1
                    try:
                        stats = container.stats(stream=False)
                        
                        # Calculate CPU percentage
                        cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                                   stats["precpu_stats"]["cpu_usage"]["total_usage"]
                        system_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                                      stats["precpu_stats"]["system_cpu_usage"]
                        cpu_count = stats["cpu_stats"].get("online_cpus", 1)
                        
                        if system_delta > 0:
                            container_data.cpu_percent = round((cpu_delta / system_delta) * cpu_count * 100, 2)
                        
                        # Calculate memory
                        if "memory_stats" in stats and "usage" in stats["memory_stats"]:
                            container_data.memory_usage = stats["memory_stats"]["usage"]
                            container_data.memory_limit = stats["memory_stats"].get("limit", 0)
                            if container_data.memory_limit > 0:
                                container_data.memory_percent = round(
                                    (container_data.memory_usage / container_data.memory_limit) * 100, 2
                                )
                    except Exception as e:
                        print(f"Error getting stats for {container.name}: {e}")
                elif container.status == "running":
                    running_count += 1
                
                container_list.append(container_data)
            
            return DockerResponse(
                containers=container_list,
                total_containers=len(container_list),
                running_containers=running_count
            )
        except Exception as e:
            print(f"Error listing containers: {e}")
            return DockerResponse(containers=[], total_containers=0, running_containers=0)
    
    def start_container(self, container_id: str) -> bool:
        """Start a container."""
        if not self.is_available:
            return False
        try:
            container = self._client.containers.get(container_id)
            container.start()
            return True
        except Exception as e:
            print(f"Error starting container {container_id}: {e}")
            return False
    
    def stop_container(self, container_id: str) -> bool:
        """Stop a container."""
        if not self.is_available:
            return False
        try:
            container = self._client.containers.get(container_id)
            container.stop()
            return True
        except Exception as e:
            print(f"Error stopping container {container_id}: {e}")
            return False
    
    def restart_container(self, container_id: str) -> bool:
        """Restart a container."""
        if not self.is_available:
            return False
        try:
            container = self._client.containers.get(container_id)
            container.restart()
            return True
        except Exception as e:
            print(f"Error restarting container {container_id}: {e}")
            return False


# Singleton instance
docker_service = DockerService()
